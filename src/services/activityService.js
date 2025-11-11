const Activity = require('../models/Activity');
const User = require('../models/User');

class ActivityService {
  // Log an activity for a user
  async logActivity(userId, action, description, type = 'system', metadata = {}, req = null) {
    try {
      const activityData = {
        userId,
        action,
        description,
        type,
        metadata
      };

      // Add request information if available
      if (req) {
        activityData.ipAddress = req.ip || req.connection.remoteAddress;
        activityData.userAgent = req.get('User-Agent');
      }

      const activity = new Activity(activityData);
      await activity.save();

      console.log(`Activity logged: ${action} for user ${userId}`);
      return activity;
    } catch (error) {
      console.error('Error logging activity:', error);
      throw error;
    }
  }

  // Get recent activities for a specific user
  async getUserActivities(userId, limit = 10) {
    try {
      return await Activity.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('userId', 'name email role');
    } catch (error) {
      console.error('Error fetching user activities:', error);
      throw error;
    }
  }

  // Get recent activities for a specific role (admin function)
  async getRoleActivities(role, limit = 50) {
    try {
      const users = await User.find({ role }).select('_id');
      const userIds = users.map(user => user._id);

      return await Activity.find({ userId: { $in: userIds } })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('userId', 'name email role');
    } catch (error) {
      console.error('Error fetching role activities:', error);
      throw error;
    }
  }

  // Get system-wide recent activities (for admins)
  async getSystemActivities(limit = 100) {
    try {
      return await Activity.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('userId', 'name email role');
    } catch (error) {
      console.error('Error fetching system activities:', error);
      throw error;
    }
  }

  // Predefined activity logging methods for common actions

  async logFormCreated(userId, formTitle, req = null) {
    return this.logActivity(
      userId,
      'Form Created',
      `Created evaluation form: "${formTitle}"`,
      'form',
      { formTitle },
      req
    );
  }

  async logFormPublished(userId, formTitle, req = null) {
    return this.logActivity(
      userId,
      'Form Published',
      `Published evaluation form: "${formTitle}"`,
      'form',
      { formTitle },
      req
    );
  }

  async logFormSubmitted(userId, formTitle, req = null) {
    return this.logActivity(
      userId,
      'Form Submitted',
      `Submitted response for: "${formTitle}"`,
      'evaluation',
      { formTitle },
      req
    );
  }

  async logReportGenerated(userId, reportType, eventName, req = null) {
    return this.logActivity(
      userId,
      'Report Generated',
      `Generated ${reportType} report for "${eventName}"`,
      'report',
      { reportType, eventName },
      req
    );
  }

  async logProfileUpdated(userId, changes, req = null) {
    const changeDescriptions = Object.keys(changes).map(key => `${key} updated`);
    return this.logActivity(
      userId,
      'Profile Updated',
      `Updated profile: ${changeDescriptions.join(', ')}`,
      'profile',
      { changes },
      req
    );
  }

  async logPasswordChanged(userId, req = null) {
    return this.logActivity(
      userId,
      'Password Changed',
      'Account password has been changed',
      'profile',
      {},
      req
    );
  }

  async logNotificationCreated(userId, notificationTitle, targetRoles, req = null) {
    return this.logActivity(
      userId,
      'Notification Created',
      `Created notification: "${notificationTitle}" for roles: ${targetRoles.join(', ')}`,
      'notification',
      { notificationTitle, targetRoles },
      req
    );
  }

  async logReminderCreated(userId, reminderTitle, req = null) {
    return this.logActivity(
      userId,
      'Reminder Created',
      `Created reminder: "${reminderTitle}"`,
      'reminder',
      { reminderTitle },
      req
    );
  }

  async logUserLogin(userId, req = null) {
    return this.logActivity(
      userId,
      'Login',
      'User logged into the system',
      'system',
      {},
      req
    );
  }

  async logUserLogout(userId, req = null) {
    return this.logActivity(
      userId,
      'Logout',
      'User logged out of the system',
      'system',
      {},
      req
    );
  }

  async logWelcomeAboard(userId, req = null) {
    return this.logActivity(
      userId,
      'Welcome Aboard',
      'First access to account',
      'system',
      {},
      req
    );
  }

  // Clean up old activities (for maintenance)
  async cleanupOldActivities(daysOld = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await Activity.deleteMany({
        createdAt: { $lt: cutoffDate }
      });

      console.log(`Cleaned up ${result.deletedCount} activities older than ${daysOld} days`);
      return result;
    } catch (error) {
      console.error('Error cleaning up old activities:', error);
      throw error;
    }
  }
}

module.exports = new ActivityService();
