const Notification = require("../../models/Notification");
const NotificationRead = require("../../models/NotificationRead");
const User = require("../../models/User");

// @desc    Get all notifications for the logged-in user
// @route   GET /api/notifications
// @access  Private (All authenticated users)
const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    console.log("[getUserNotifications] Fetching notifications for user:", {
      userId,
      userRole,
    });

    // Strict role-based filtering:
    // - Role-targeted notifications: must include the user's role in targetRoles
    // - Direct notifications: must include the user's userId in targetUsers
    // - PSA (psas) notifications are naturally restricted by role matching; no PSA data is exposed to non-PSAS users
    const visibilityFilter = {
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

    console.log(
      "[getUserNotifications] Visibility filter:",
      JSON.stringify(visibilityFilter, null, 2)
    );

    const notifications = await Notification.find(visibilityFilter)
      .populate("createdBy", "name")
      .sort({ createdAt: -1 });

    console.log(
      `[getUserNotifications] Found ${notifications.length} notifications for user ${userId}`
    );

    // Get read status for these notifications scoped to this user only
    const notificationIds = notifications.map((n) => n._id);
    const readStatuses = await NotificationRead.find({
      notificationId: { $in: notificationIds },
      userId,
    });

    const readMap = new Map();
    readStatuses.forEach((read) => {
      readMap.set(read.notificationId.toString(), read.readAt);
    });

    // Attach read status; do not leak any PSA-only internal metadata
    const notificationsWithReadStatus = notifications.map((notification) => ({
      ...notification.toObject(),
      isRead: readMap.has(notification._id.toString()),
      readAt: readMap.get(notification._id.toString()) || null,
    }));

    res.json({
      success: true,
      data: notificationsWithReadStatus,
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
      type,
      priority,
      targetRoles,
      targetUsers,
      relatedEntity,
      expiresAt,
    } = req.body;

    if (!title || !message || !targetRoles || targetRoles.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Title, message, and target roles are required",
      });
    }

    // Validate target roles
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

    const notificationData = {
      title,
      message,
      type: type || "info",
      priority: priority || "medium",
      targetRoles,
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

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return res.status(400).json({
        success: false,
        message: "Notification IDs array is required",
      });
    }

    // Verify user can access these notifications
    const notifications = await Notification.find({
      _id: { $in: notificationIds },
      $or: [{ targetRoles: req.user.role }, { targetUsers: userId }],
    });

    const accessibleIds = notifications.map((n) => n._id.toString());
    const inaccessibleIds = notificationIds.filter(
      (id) => !accessibleIds.includes(id)
    );

    if (inaccessibleIds.length > 0) {
      return res.status(403).json({
        success: false,
        message: `Access denied to notifications: ${inaccessibleIds.join(
          ", "
        )}`,
      });
    }

    // Mark as read
    const readOperations = notificationIds.map((notificationId) => ({
      updateOne: {
        filter: { notificationId, userId },
        update: { readAt: new Date() },
        upsert: true,
      },
    }));

    await NotificationRead.bulkWrite(readOperations);

    res.json({
      success: true,
      message: `${notificationIds.length} notifications marked as read`,
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

// @desc    Delete a notification (admin only)
// @route   DELETE /api/notifications/:id
// @access  Private (School Admins, MIS only)
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
    const isCreator = notification.createdBy && notification.createdBy.toString() === req.user._id.toString();
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

    console.log(`[deleteMultiple] Found ${notifications.length} notifications to check`);

    // Check which notifications user can delete
    const deletableIds = [];
    const nonDeletableIds = [];

    for (const notification of notifications) {
      const isCreator = notification.createdBy && notification.createdBy.toString() === req.user._id.toString();
      const isTargetedToRole = notification.targetRoles.includes(req.user.role);
      const isAdmin = ["school-admin", "mis"].includes(req.user.role);

      const canDelete = isCreator || isTargetedToRole || isAdmin;

      console.log(`[deleteMultiple] Notification ${notification._id}:`, {
        canDelete,
        createdBy: notification.createdBy ? notification.createdBy.toString() : null,
        userId: req.user._id.toString(),
        isCreator,
        targetRoles: notification.targetRoles,
        userRole: req.user.role,
        isTargetedToRole,
        isAdmin,
      });

      if (canDelete) {
        deletableIds.push(notification._id.toString());
      } else {
        nonDeletableIds.push(notification._id.toString());
      }
    }

    if (nonDeletableIds.length > 0) {
      console.log(`[deleteMultiple] Access denied to notifications: ${nonDeletableIds.join(", ")}`);
      return res.status(403).json({
        success: false,
        message: `Access denied to delete notifications: ${nonDeletableIds.join(
          ", "
        )}`,
      });
    }

    // Delete notifications
    const deleteResult = await Notification.deleteMany({
      _id: { $in: notificationIds },
    });

    // Also delete read statuses
    await NotificationRead.deleteMany({
      notificationId: { $in: notificationIds },
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
// @access  Private (PSAS, Club Officers, School Admins, MIS)
const getNotificationStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    // Get total notifications for user
    const totalNotifications = await Notification.countDocuments({
      $or: [{ targetRoles: userRole }, { targetUsers: userId }],
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } },
      ],
    });

    // Get unread count
    const readNotificationIds = await NotificationRead.find({
      userId,
    }).distinct("notificationId");
    const unreadCount = await Notification.countDocuments({
      _id: { $nin: readNotificationIds },
      $or: [{ targetRoles: userRole }, { targetUsers: userId }],
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } },
      ],
    });

    res.json({
      success: true,
      data: {
        total: totalNotifications,
        unread: unreadCount,
        read: totalNotifications - unreadCount,
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
  deleteNotification,
  deleteMultiple,
  getNotificationStats,
};
