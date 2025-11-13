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

      const notificationData = {
        title,
        message,
        type,
        priority,
        targetRoles,
        isSystemGenerated: !createdBy,
      };

      if (targetUsers.length > 0) {
        notificationData.targetUsers = targetUsers;
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
    const title = `New Evaluation Form Published: ${form.title}`;
    const message = `A new evaluation form "${form.title}" has been published and is now available for responses.`;

    // Notify participants who are in the form's attendee list
    const participantUsers = (form.attendeeList || [])
      .filter((attendee) => attendee.userId)
      .map((attendee) => attendee.userId);

    if (participantUsers.length > 0) {
      await this.createRoleBasedNotification(title, message, [], {
        type: "success",
        priority: "high",
        targetUsers: participantUsers,
        relatedEntity: { type: "form", id: form._id },
        createdBy,
      });
    }

    // Notify PSAS and Club Officers
    await this.createRoleBasedNotification(
      `Form Published: ${form.title}`,
      `You have successfully published the evaluation form "${form.title}".`,
      ["psas", "club-officer"],
      {
        type: "success",
        priority: "medium",
        relatedEntity: { type: "form", id: form._id },
        createdBy,
      }
    );
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

  async notifyFormClosed(form) {
    const title = `Evaluation Form Closed: ${form.title}`;
    const message = `The evaluation form "${form.title}" has been closed and is no longer accepting responses.`;

    await this.createRoleBasedNotification(
      title,
      message,
      ["participant", "psas", "club-officer"],
      {
        type: "info",
        priority: "medium",
        relatedEntity: { type: "form", id: form._id },
      }
    );
  }

  async notifyResponseThresholdReached(form, threshold) {
    const title = `Response Threshold Reached: ${form.title}`;
    const message = `${threshold}% of expected responses have been received for "${form.title}". Current progress: ${form.responseCount} responses.`;

    await this.createRoleBasedNotification(
      title,
      message,
      ["psas", "club-officer", "school-admin"],
      {
        type: "info",
        priority: "medium",
        relatedEntity: { type: "form", id: form._id },
      }
    );
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
      const message = `${user.name} has created a reminder: "${
        reminder.title
      }"${
        reminder.description ? " - " + reminder.description : ""
      }. Reminder date: ${new Date(
        reminder.date
      ).toLocaleDateString()}. Priority: ${reminder.priority}.`;

      console.log("[notifyReminderCreated] Creating notification with data:", {
        title,
        message,
        targetRoles: [
          "participant",
          "psas",
          "club-officer",
          "school-admin",
          "mis",
        ],
        type: "reminder",
        createdBy: user._id,
      });

      // Notify ALL roles in the system about the reminder creation
      // This ensures all system users (participants, psas, club-officers, school-admins, mis) are notified
      const notification = await this.createRoleBasedNotification(
        title,
        message,
        ["participant", "psas", "club-officer", "school-admin", "mis"],
        {
          type: "reminder",
          priority:
            reminder.priority === "high"
              ? "high"
              : reminder.priority === "low"
              ? "low"
              : "medium",
          relatedEntity: { type: "reminder", id: reminder._id },
          createdBy: user._id,
        }
      );

      console.log(
        `✅ Reminder notification created and sent to all roles for reminder: ${reminder.title}`,
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
    // Notify all roles that a reminder is due soon
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
    const message = `The reminder "${reminder.title}" created by ${user.name} is due on ${dueDate}. Priority: ${reminder.priority}. Take action now if needed.`;

    // Notify all roles
    const notification = await this.createRoleBasedNotification(
      title,
      message,
      ["participant", "psas", "club-officer", "school-admin", "mis"],
      {
        type: "warning",
        priority:
          reminder.priority === "high"
            ? "high"
            : reminder.priority === "low"
            ? "low"
            : "medium",
        relatedEntity: { type: "reminder", id: reminder._id },
        createdBy: user._id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expires in 24 hours
      }
    );

    console.log(
      `⏰ Reminder due soon notification sent for: ${reminder.title}`
    );
    return notification;
  }

  async notifyReminderCompleted(reminder, user) {
    // Notify all roles that a reminder has been completed
    if (!reminder || !reminder._id || !user || !user._id) {
      console.warn(
        "notifyReminderCompleted: missing reminder or user context, skipping notification"
      );
      return null;
    }

    const title = `✓ Reminder Completed: ${reminder.title}`;
    const message = `The reminder "${reminder.title}" created by ${user.name} has been marked as completed.`;

    // Notify all roles
    const notification = await this.createRoleBasedNotification(
      title,
      message,
      ["participant", "psas", "club-officer", "school-admin", "mis"],
      {
        type: "success",
        priority: "low",
        relatedEntity: { type: "reminder", id: reminder._id },
        createdBy: user._id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Expires in 7 days
      }
    );

    console.log(
      `✓ Reminder completed notification sent for: ${reminder.title}`
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
