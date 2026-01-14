const Notification = require("../models/Notification");
const User = require("../models/User");

class NotificationService {
  // Create a notification for specific roles
  async createRoleBasedNotification(title, message, targetRoles, options = {}) {
    try {
      const {
        type = "info",
        priority = "medium",
        targetUsers = [],
        relatedEntity = null,
        expiresAt = null,
        createdBy = null,
      } = options;

      // Determine if this is a reminder-type notification
      const isReminderNotification =
        type === "reminder" ||
        (relatedEntity && relatedEntity.type === "reminder");

      // Filter target users based on their mute preferences
      let filteredTargetUsers = targetUsers;
      if (targetUsers.length > 0) {
        const users = await User.find({
          _id: { $in: targetUsers },
        }).select("_id muteNotifications muteReminders");

        filteredTargetUsers = users
          .filter((user) => {
            // For reminder notifications, check muteReminders
            if (isReminderNotification) {
              return !user.muteReminders;
            }
            // For regular notifications, check muteNotifications
            return !user.muteNotifications;
          })
          .map((user) => user._id);

        // If all target users have muted, don't create the notification
        if (filteredTargetUsers.length === 0 && targetRoles.length === 0) {
          console.log(
            `[createRoleBasedNotification] Skipping notification "${title}" - all target users have muted ${
              isReminderNotification ? "reminders" : "notifications"
            }`
          );
          return null;
        }
      }

      const notificationData = {
        title,
        message,
        type,
        priority,
        targetRoles,
        isSystemGenerated: !createdBy,
      };

      if (filteredTargetUsers.length > 0) {
        notificationData.targetUsers = filteredTargetUsers;
      }

      if (relatedEntity) {
        notificationData.relatedEntity = relatedEntity;
      }

      if (expiresAt) {
        notificationData.expiresAt = expiresAt;
      }

      if (createdBy) {
        notificationData.createdBy = createdBy;
      }

      console.log(
        "[createRoleBasedNotification] Notification data before save:",
        JSON.stringify(notificationData, null, 2)
      );

      const notification = new Notification(notificationData);
      await notification.save();

      console.log(
        `[createRoleBasedNotification] ✅ Notification saved to DB: ${title} for roles: ${targetRoles.join(
          ", "
        )}`,
        { _id: notification._id }
      );
      return notification;
    } catch (error) {
      console.error(
        "[createRoleBasedNotification] Error creating role-based notification:",
        error
      );
      throw error;
    }
  }

  // System notifications for different events
  async notifyFormPublished(form, createdBy) {
    // Notification for participants - generic message without creator info
    const participantTitle = `Evaluation Form Shared With You`;
    const participantMessage = `An evaluation form "${form.title}" has been shared with you and is now available for your response.`;

    // Notify participants who are in the form's attendee list
    const participantUsers = (form.attendeeList || [])
      .filter((attendee) => attendee.userId)
      .map((attendee) => attendee.userId);

    if (participantUsers.length > 0) {
      await this.createRoleBasedNotification(
        participantTitle,
        participantMessage,
        [],
        {
          type: "success",
          priority: "high",
          targetUsers: participantUsers,
          relatedEntity: { type: "form", id: form._id },
          createdBy,
        }
      );
    }

    // Notify only the creator's role
    const creator = await User.findById(createdBy);
    if (creator) {
      await this.createRoleBasedNotification(
        `Form Published: ${form.title}`,
        `You have successfully published the evaluation form "${form.title}".`,
        [creator.role], // Only send to creator's role
        {
          type: "success",
          priority: "medium",
          relatedEntity: { type: "form", id: form._id },
          createdBy,
        }
      );
    }
  }

  async notifyFormClosingSoon(form) {
    const title = `Evaluation Form Closing Soon: ${form.title}`;
    const message = `The evaluation form "${form.title}" will be closing for responses in 24 hours. Please ensure all responses are submitted.`;

    await this.createRoleBasedNotification(title, message, ["participant"], {
      type: "warning",
      priority: "high",
      relatedEntity: { type: "form", id: form._id },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expires in 24 hours
    });
  }

  async notifyFormClosed(form, createdBy) {
    const title = `Evaluation Form Closed: ${form.title}`;
    const message = `The evaluation form "${form.title}" has been closed and is no longer accepting responses.`;

    // Notify participants
    await this.createRoleBasedNotification(title, message, ["participant"], {
      type: "info",
      priority: "medium",
      relatedEntity: { type: "form", id: form._id },
    });

    // Notify only the creator's role
    if (createdBy) {
      const creator = await User.findById(createdBy);
      if (creator) {
        await this.createRoleBasedNotification(title, message, [creator.role], {
          type: "info",
          priority: "medium",
          relatedEntity: { type: "form", id: form._id },
          createdBy,
        });
      }
    }
  }

  async notifyResponseThresholdReached(form, threshold, createdBy) {
    const title = `Response Threshold Reached: ${form.title}`;
    const message = `${threshold}% of expected responses have been received for "${form.title}". Current progress: ${form.responseCount} responses.`;

    // Notify only the creator's role
    if (createdBy) {
      const creator = await User.findById(createdBy);
      if (creator) {
        await this.createRoleBasedNotification(title, message, [creator.role], {
          type: "info",
          priority: "medium",
          relatedEntity: { type: "form", id: form._id },
          createdBy,
        });
      }
    }
  }

  async notifyCertificateGenerated(certificate, recipient) {
    const title = `Certificate Generated`;
    const message = `Your certificate for "${certificate.eventName}" has been generated and is ready for download.`;

    await this.createRoleBasedNotification(
      title,
      message,
      [], // Empty array for roles since we're targeting specific users
      {
        type: "success",
        priority: "medium",
        targetUsers: [recipient],
        relatedEntity: { type: "certificate", id: certificate._id },
      }
    );
  }

  async notifyReminderCreated(reminder, user) {
    // Safety: ensure we have what we need; if not, do not throw (reminder creation should still succeed)
    if (!reminder || !reminder._id || !user || !user._id) {
      console.warn(
        "notifyReminderCreated: missing reminder or user context, skipping in-app notification"
      );
      return null;
    }

    try {
      const title = `📅 Reminder Created: ${reminder.title}`;
      const message = `You have created a reminder: "${reminder.title}"${
        reminder.description ? " - " + reminder.description : ""
      }. Reminder date: ${new Date(reminder.date).toLocaleDateString()}.`;

      console.log("[notifyReminderCreated] Creating notification with data:", {
        title,
        message,
        targetUsers: [user._id],
        type: "reminder",
        createdBy: user._id,
      });

      // Notify only the user who created the reminder
      const notification = await this.createRoleBasedNotification(
        title,
        message,
        [], // No role targeting
        {
          type: "reminder",
          priority:
            reminder.priority === "high"
              ? "high"
              : reminder.priority === "low"
              ? "low"
              : "medium",
          targetUsers: [user._id], // Only notify the creator
          relatedEntity: { type: "reminder", id: reminder._id },
          createdBy: user._id,
        }
      );

      console.log(
        `✅ Reminder notification created for user: ${user.name} for reminder: ${reminder.title}`,
        { notificationId: notification._id }
      );
      return notification;
    } catch (error) {
      console.error(
        "[notifyReminderCreated] Error creating notification:",
        error
      );
      throw error;
    }
  }

  async notifyReminderDueSoon(reminder, user) {
    // Notify only the user who created the reminder
    if (!reminder || !reminder._id || !user || !user._id) {
      console.warn(
        "notifyReminderDueSoon: missing reminder or user context, skipping notification"
      );
      return null;
    }

    const dueDate = new Date(reminder.date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const title = `⏰ Reminder Due Soon: ${reminder.title}`;
    const message = `Your reminder "${reminder.title}" is due on ${dueDate}. Take action now if needed.`;

    // Notify only the creator
    const notification = await this.createRoleBasedNotification(
      title,
      message,
      [], // No role targeting
      {
        type: "warning",
        priority:
          reminder.priority === "high"
            ? "high"
            : reminder.priority === "low"
            ? "low"
            : "medium",
        targetUsers: [user._id], // Only notify the creator
        relatedEntity: { type: "reminder", id: reminder._id },
        createdBy: user._id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expires in 24 hours
      }
    );

    console.log(
      `⏰ Reminder due soon notification sent to user: ${user.name} for: ${reminder.title}`
    );
    return notification;
  }

  async notifyReminderCompleted(reminder, user) {
    // Notify only the user who completed the reminder
    if (!reminder || !reminder._id || !user || !user._id) {
      console.warn(
        "notifyReminderCompleted: missing reminder or user context, skipping notification"
      );
      return null;
    }

    const title = `✓ Reminder Completed: ${reminder.title}`;
    const message = `Your reminder "${reminder.title}" has been marked as completed.`;

    // Notify only the user who completed it
    const notification = await this.createRoleBasedNotification(
      title,
      message,
      [], // No role targeting
      {
        type: "success",
        priority: "low",
        targetUsers: [user._id], // Only notify the user
        relatedEntity: { type: "reminder", id: reminder._id },
        createdBy: user._id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Expires in 7 days
      }
    );

    console.log(
      `✓ Reminder completed notification sent to user: ${user.name} for: ${reminder.title}`
    );
    return notification;
  }

  async notifySystemMaintenance(
    message,
    affectedRoles = [
      "participant",
      "psas",
      "club-officer",
      "school-admin",
      "mis",
    ]
  ) {
    const title = "System Maintenance Notice";

    await this.createRoleBasedNotification(title, message, affectedRoles, {
      type: "warning",
      priority: "high",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Expires in 7 days
    });
  }

  async notifyNewUserWelcome(user) {
    const title = "Welcome to La Verdad Event Evaluation System";
    const message = `Welcome ${
      user.name
    }! Your account has been created successfully. You can now access the system with your ${user.role.replace(
      "-",
      " "
    )} privileges.`;

    await this.createRoleBasedNotification(
      title,
      message,
      [], // Target specific user
      {
        type: "success",
        priority: "medium",
        targetUsers: [user._id],
      }
    );
  }

  async notifyRoleSpecificAnnouncement(
    title,
    message,
    targetRoles,
    options = {}
  ) {
    await this.createRoleBasedNotification(title, message, targetRoles, {
      type: "info",
      priority: "medium",
      ...options,
    });
  }

  // Bulk notification for multiple users
  async notifyUsers(title, message, userIds, options = {}) {
    await this.createRoleBasedNotification(
      title,
      message,
      [], // No role targeting
      {
        type: "info",
        priority: "medium",
        targetUsers: userIds,
        ...options,
      }
    );
  }

  async notifyCertificateEmailFailed(certificate, recipient) {
    const title = "Certificate Email Delivery Failed";
    const message = `We couldn't send your certificate for "${
      certificate.eventId?.name || "Event"
    }" to your email. You can still download it from your certificates dashboard.`;

    await this.createRoleBasedNotification(
      title,
      message,
      [], // Target specific user
      {
        type: "warning",
        priority: "medium",
        targetUsers: [recipient],
        relatedEntity: { type: "certificate", id: certificate._id },
        data: {
          certificateId: certificate.certificateId,
          downloadUrl: `/api/certificates/download/${certificate.certificateId}`,
        },
      }
    );
  }

  // Get notification counts for dashboard
  async getUserNotificationCounts(userId, userRole) {
    try {
      // Get total notifications for user
      const total = await Notification.countDocuments({
        $or: [{ targetRoles: userRole }, { targetUsers: userId }],
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } },
        ],
      });

      // Get unread count
      const NotificationRead = require("../models/NotificationRead");
      const readNotificationIds = await NotificationRead.find({
        userId,
      }).distinct("notificationId");
      const unread = await Notification.countDocuments({
        _id: { $nin: readNotificationIds },
        $or: [{ targetRoles: userRole }, { targetUsers: userId }],
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } },
        ],
      });

      return { total, unread, read: total - unread };
    } catch (error) {
      console.error("Error getting notification counts:", error);
      return { total: 0, unread: 0, read: 0 };
    }
  }
}

module.exports = new NotificationService();
