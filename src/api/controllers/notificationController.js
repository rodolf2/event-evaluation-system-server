const Notification = require("../../models/Notification");
const NotificationRead = require("../../models/NotificationRead");
const User = require("../../models/User");
const { emitUpdate } = require("../../utils/socket");

// Helper function to build visibility filter
const buildVisibilityFilter = (userId, userRole) => {
  return {
    $and: [
      {
        $or: [{ targetRoles: userRole }, { targetUsers: userId }],
      },
      {
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } },
        ],
      },
    ],
  };
};

// @desc    Get all notifications for the logged-in user with pagination
// @route   GET /api/notifications
// @access  Private (All authenticated users)
const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    const muteNotifications = req.user.muteNotifications || false;
    const muteReminders = req.user.muteReminders || false;
    const { page = 1, limit = 20, unreadOnly = "false" } = req.query;

    console.log("[getUserNotifications] Fetching notifications for user:", {
      userId,
      userRole,
      page,
      limit,
      unreadOnly,
      muteNotifications,
      muteReminders,
    });

    // Build base visibility filter
    const visibilityFilter = buildVisibilityFilter(userId, userRole);

    // Add mute preference filters
    const muteFilters = [];

    // If user has muted notifications, exclude non-reminder notifications
    if (muteNotifications) {
      // Only show reminder-type notifications (exclude regular ones)
      muteFilters.push({
        $or: [{ type: "reminder" }, { "relatedEntity.type": "reminder" }],
      });
    }

    // If user has muted reminders, exclude reminder-type notifications
    if (muteReminders) {
      // Exclude reminder-type notifications
      muteFilters.push({
        $and: [
          { type: { $ne: "reminder" } },
          {
            $or: [
              { "relatedEntity.type": { $exists: false } },
              { "relatedEntity.type": { $ne: "reminder" } },
            ],
          },
        ],
      });
    }

    // Combine filters
    let finalFilter = visibilityFilter;
    if (muteFilters.length > 0) {
      finalFilter = {
        $and: [visibilityFilter, ...muteFilters],
      };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get notifications
    const notifications = await Notification.find(finalFilter)
      .populate("createdBy", "name role")
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalCount = await Notification.countDocuments(finalFilter);

    console.log(
      `[getUserNotifications] Found ${notifications.length} notifications (${totalCount} total) for user ${userId}`
    );

    // Get read status for these notifications
    const notificationIds = notifications.map((n) => n._id);
    const readStatuses = await NotificationRead.find({
      notificationId: { $in: notificationIds },
      userId,
    });

    const readMap = new Map();
    readStatuses.forEach((read) => {
      readMap.set(read.notificationId.toString(), read.readAt);
    });

    // Attach read status and action URL
    const notificationsWithReadStatus = notifications.map((notification) => {
      const isRead = readMap.has(notification._id.toString());

      // Generate action URL based on related entity
      let actionUrl = null;
      if (notification.relatedEntity) {
        const { entityType, id } = notification.relatedEntity;
        switch (entityType) {
          case "form":
            actionUrl =
              userRole === "participant"
                ? `/participant/forms/${id}`
                : `/psas/forms/${id}`;
            break;
          case "certificate":
            actionUrl = `/participant/certificates`;
            break;
          case "reminder":
            actionUrl =
              userRole === "participant"
                ? `/participant/reminders`
                : `/psas/reminders`;
            break;
          default:
            actionUrl = null;
        }
      }

      return {
        ...notification.toObject(),
        isRead,
        readAt: readMap.get(notification._id.toString()) || null,
        actionUrl,
      };
    });

    // Filter by unread if requested
    const finalNotifications =
      unreadOnly === "true"
        ? notificationsWithReadStatus.filter((n) => !n.isRead)
        : notificationsWithReadStatus;

    res.json({
      success: true,
      data: finalNotifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching user notifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

// @desc    Create a new notification
// @route   POST /api/notifications
// @access  Private (PSAS, Club Officers, School Admins, MIS)
const createNotification = async (req, res) => {
  try {
    const {
      title,
      message,
      targetRoles,
      targetUsers,
      relatedEntity,
      expiresAt,
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "Title and message are required",
      });
    }

    // Set default targetRoles based on creator's role if not provided
    if (!targetRoles || targetRoles.length === 0) {
      switch (req.user.role) {
        case "psas":
          targetRoles = ["psas"];
          break;
        case "club-officer":
          targetRoles = ["club-officer"];
          break;
        case "school-admin":
          targetRoles = ["school-admin"];
          break;
        case "mis":
          targetRoles = ["mis"];
          break;
        case "participant":
          targetRoles = ["participant"];
          break;
        default:
          targetRoles = [req.user.role]; // fallback to creator's role
      }
    }

    if (
      (!targetRoles || targetRoles.length === 0) &&
      (!targetUsers || targetUsers.length === 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one target role or target user is required",
      });
    }

    // Validate target roles if provided
    if (targetRoles && targetRoles.length > 0) {
      const validRoles = [
        "participant",
        "psas",
        "club-officer",
        "school-admin",
        "mis",
      ];
      const invalidRoles = targetRoles.filter(
        (role) => !validRoles.includes(role)
      );
      if (invalidRoles.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid target roles: ${invalidRoles.join(", ")}`,
        });
      }
    }

    const notificationData = {
      title,
      message,
      targetRoles: targetRoles || [],
      createdBy: req.user._id,
      isSystemGenerated: false,
    };

    if (targetUsers && targetUsers.length > 0) {
      notificationData.targetUsers = targetUsers;
    }

    if (relatedEntity) {
      notificationData.relatedEntity = relatedEntity;
    }

    if (expiresAt) {
      notificationData.expiresAt = new Date(expiresAt);
    }

    const notification = new Notification(notificationData);
    await notification.save();

    await notification.populate("createdBy", "name");

    res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data: notification,
    });

    // Emit socket event for real-time notifications
    // Notify specific users if provided
    if (targetUsers && targetUsers.length > 0) {
      targetUsers.forEach(userId => {
        emitUpdate("notification-received", notification, userId);
      });
    }

    // Notify roles
    if (targetRoles && targetRoles.length > 0) {
      // In a real production app, you might want to emit to specific role rooms
      // For now, we'll broadcast it and let clients filter or handle it
      emitUpdate("notification-received", notification);
    }
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create notification",
      error: error.message,
    });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Check if notification exists and user can access it
    const notification = await Notification.findOne({
      _id: id,
      $or: [{ targetRoles: req.user.role }, { targetUsers: userId }],
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found or access denied",
      });
    }

    // Create or update read status
    await NotificationRead.findOneAndUpdate(
      { notificationId: id, userId: userId },
      { readAt: new Date() },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
      error: error.message,
    });
  }
};

// @desc    Mark multiple notifications as read
// @route   PUT /api/notifications/read-multiple
// @access  Private
const markMultipleAsRead = async (req, res) => {
  try {
    const { notificationIds } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return res.status(400).json({
        success: false,
        message: "Notification IDs array is required",
      });
    }

    // Verify user can access these notifications
    const notifications = await Notification.find({
      _id: { $in: notificationIds },
      $or: [{ targetRoles: userRole }, { targetUsers: userId }],
    });

    const accessibleIds = notifications.map((n) => n._id.toString());

    // Mark accessible ones as read
    const readOperations = accessibleIds.map((notificationId) => ({
      updateOne: {
        filter: { notificationId, userId },
        update: { readAt: new Date() },
        upsert: true,
      },
    }));

    if (readOperations.length > 0) {
      await NotificationRead.bulkWrite(readOperations);
    }

    res.json({
      success: true,
      message: `${accessibleIds.length} notifications marked as read`,
    });
  } catch (error) {
    console.error("Error marking multiple notifications as read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark notifications as read",
      error: error.message,
    });
  }
};

// @desc    Mark all notifications as read for current user
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    // Get all notifications for this user
    const visibilityFilter = buildVisibilityFilter(userId, userRole);
    const notifications = await Notification.find(visibilityFilter).select(
      "_id"
    );

    const notificationIds = notifications.map((n) => n._id);

    // Mark all as read
    const readOperations = notificationIds.map((notificationId) => ({
      updateOne: {
        filter: { notificationId, userId },
        update: { readAt: new Date() },
        upsert: true,
      },
    }));

    if (readOperations.length > 0) {
      await NotificationRead.bulkWrite(readOperations);
    }

    res.json({
      success: true,
      message: `${notificationIds.length} notifications marked as read`,
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
      error: error.message,
    });
  }
};

// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    // Allow deletion if:
    // 1. User created the notification, OR
    // 2. Notification is targeted to user's role, OR
    // 3. User is school-admin or mis (can delete any notification)
    const isCreator =
      notification.createdBy &&
      notification.createdBy.toString() === req.user._id.toString();
    const isTargetedToRole = notification.targetRoles.includes(req.user.role);
    const isAdmin = ["school-admin", "mis"].includes(req.user.role);

    const canDelete = isCreator || isTargetedToRole || isAdmin;

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this notification",
      });
    }

    await Notification.findByIdAndDelete(id);

    // Also delete read statuses
    await NotificationRead.deleteMany({ notificationId: id });

    res.json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete notification",
      error: error.message,
    });
  }
};

// @desc    Delete multiple notifications
// @route   DELETE /api/notifications/delete-multiple
// @access  Private
const deleteMultiple = async (req, res) => {
  console.log("[deleteMultiple] === FUNCTION CALLED ===");
  console.log("[deleteMultiple] Request body:", req.body);
  console.log("[deleteMultiple] User:", req.user);

  try {
    const { notificationIds } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    console.log("[deleteMultiple] Parsed request data:", {
      userId,
      userRole,
      notificationIds,
    });

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return res.status(400).json({
        success: false,
        message: "Notification IDs array is required",
      });
    }

    // Verify user can delete these notifications
    const notifications = await Notification.find({
      _id: { $in: notificationIds },
    });

    console.log(
      `[deleteMultiple] Found ${notifications.length} notifications to check`
    );

    // Check which notifications user can delete
    const deletableIds = [];
    const nonDeletableIds = [];

    for (const notification of notifications) {
      const isCreator =
        notification.createdBy &&
        notification.createdBy.toString() === req.user._id.toString();
      const isTargetedToRole = notification.targetRoles.includes(req.user.role);
      const isAdmin = ["school-admin", "mis"].includes(req.user.role);

      const canDelete = isCreator || isTargetedToRole || isAdmin;

      console.log(`[deleteMultiple] Notification ${notification._id}:`, {
        canDelete,
        createdBy: notification.createdBy
          ? notification.createdBy.toString()
          : null,
        userId: req.user._id.toString(),
        isCreator,
        targetRoles: notification.targetRoles,
        userRole: req.user.role,
        isTargetedToRole,
        isAdmin,
      });

      if (canDelete) {
        deletableIds.push(notification._id);
      } else {
        nonDeletableIds.push(notification._id.toString());
      }
    }

    if (nonDeletableIds.length > 0) {
      console.log(
        `[deleteMultiple] Access denied to notifications: ${nonDeletableIds.join(
          ", "
        )}`
      );
      return res.status(403).json({
        success: false,
        message: `Access denied to delete notifications: ${nonDeletableIds.join(
          ", "
        )}`,
      });
    }

    // Delete notifications
    const deleteResult = await Notification.deleteMany({
      _id: { $in: deletableIds },
    });

    // Also delete read statuses
    await NotificationRead.deleteMany({
      notificationId: { $in: deletableIds },
    });

    res.json({
      success: true,
      message: `${deleteResult.deletedCount} notifications deleted successfully`,
    });
  } catch (error) {
    console.error("Error deleting multiple notifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete notifications",
      error: error.message,
    });
  }
};

// @desc    Get notification statistics
// @route   GET /api/notifications/stats
// @access  Private
const getNotificationStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    // Build visibility filter
    const visibilityFilter = buildVisibilityFilter(userId, userRole);

    // Get total notifications for user
    const totalNotifications = await Notification.countDocuments(
      visibilityFilter
    );

    // Get read notification IDs
    const readNotificationIds = await NotificationRead.find({
      userId,
    }).distinct("notificationId");

    // Get unread count
    const unreadFilter = {
      ...visibilityFilter,
      _id: { $nin: readNotificationIds },
    };
    const unreadCount = await Notification.countDocuments(unreadFilter);

    // Get counts by type
    const typeStats = await Notification.aggregate([
      { $match: visibilityFilter },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get counts by priority
    const priorityStats = await Notification.aggregate([
      { $match: visibilityFilter },
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        total: totalNotifications,
        unread: unreadCount,
        read: totalNotifications - unreadCount,
        byType: typeStats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byPriority: priorityStats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    console.error("Error fetching notification stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notification statistics",
      error: error.message,
    });
  }
};

module.exports = {
  getUserNotifications,
  createNotification,
  markAsRead,
  markMultipleAsRead,
  markAllAsRead,
  deleteNotification,
  deleteMultiple,
  getNotificationStats,
};
