const nodemailer = require("nodemailer");
const Reminder = require("../../models/Reminder");

class ReminderService {
  constructor() {
    // Configure nodemailer transporter
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  generateReminderEmailTemplate(reminder, user) {
    const reminderDate = new Date(reminder.date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const priorityColors = {
      low: "#10B981", // green
      medium: "#F59E0B", // yellow
      high: "#EF4444", // red
    };

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; text-align: center;">📅 Reminder Notification</h1>
        </div>

        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px;">
          <h2 style="color: #374151; margin-bottom: 20px;">Hello ${user.name},</h2>

          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${priorityColors[reminder.priority]};">
            <h3 style="margin: 0 0 10px 0; color: #1f2937;">${reminder.title}</h3>
            <p style="margin: 0 0 15px 0; color: #6b7280; line-height: 1.5;">${reminder.description || "No description provided."}</p>

            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #374151;">📅 Date:</strong>
                <span style="color: #6b7280; margin-left: 8px;">${reminderDate}</span>
              </div>
              <div>
                <span style="background: ${priorityColors[reminder.priority]}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                  ${reminder.priority.toUpperCase()} PRIORITY
                </span>
              </div>
            </div>
          </div>

          <p style="color: #6b7280; line-height: 1.6;">
            This is a reminder for an important event or task. Please take appropriate action as needed.
          </p>

          <div style="background: #eff6ff; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; color: #1e40af; font-weight: 500;">
              💡 <strong>Tip:</strong> You can view and manage all your reminders in your dashboard at any time.
            </p>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

          <div style="text-align: center; color: #9ca3af; font-size: 14px;">
            <p>This reminder was sent by La Verdad Christian College Event Management System</p>
            <p>If you have any questions, please contact your system administrator.</p>
          </div>
        </div>
      </div>
    `;
  }

  async sendReminderEmail(reminderId) {
    try {
      const reminder = await Reminder.findById(reminderId).populate("userId", "name email");

      if (!reminder) {
        throw new Error("Reminder not found");
      }

      const user = reminder.userId;
      if (!user || !user.email) {
        console.warn(`Cannot send reminder email: User or email not found for reminder ${reminderId}`);
        return;
      }

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: `📅 Reminder: ${reminder.title}`,
        html: this.generateReminderEmailTemplate(reminder, user),
      };

      const result = await this.transporter.sendMail(mailOptions);

      // Update reminder to mark email as sent
      await Reminder.findByIdAndUpdate(reminderId, {
        emailSent: true,
        emailSentAt: new Date(),
      });

      console.log(`Reminder email sent successfully to ${user.email}`);
      return result;
    } catch (error) {
      console.error("Error sending reminder email:", error);
      throw error;
    }
  }

  async createReminder(reminderData) {
    try {
      const reminder = new Reminder(reminderData);
      await reminder.save();

      // Send email notification
      try {
        await this.sendReminderEmail(reminder._id);
      } catch (emailError) {
        console.error("Failed to send reminder email:", emailError);
        // Don't fail the entire operation if email fails
      }

      return reminder;
    } catch (error) {
      console.error("Error creating reminder:", error);
      throw error;
    }
  }

  async getUserReminders(userId) {
    try {
      return await Reminder.find({ userId }).sort({ date: 1, createdAt: -1 });
    } catch (error) {
      console.error("Error fetching user reminders:", error);
      throw error;
    }
  }

  async deleteReminder(reminderId, userId) {
    try {
      const reminder = await Reminder.findOneAndDelete({
        _id: reminderId,
        userId: userId,
      });

      if (!reminder) {
        throw new Error("Reminder not found or unauthorized");
      }

      return reminder;
    } catch (error) {
      console.error("Error deleting reminder:", error);
      throw error;
    }
  }

  // Method to check and send reminders for upcoming events (could be called by a cron job)
  async sendUpcomingReminders() {
    try {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

      const upcomingReminders = await Reminder.find({
        date: { $gte: now, $lte: tomorrow },
        emailSent: { $ne: true }, // Not already sent
        completed: false,
      }).populate("userId", "name email");

      console.log(`Found ${upcomingReminders.length} upcoming reminders to send`);

      for (const reminder of upcomingReminders) {
        try {
          await this.sendReminderEmail(reminder._id);
        } catch (error) {
          console.error(`Failed to send reminder ${reminder._id}:`, error);
        }
      }

      return upcomingReminders.length;
    } catch (error) {
      console.error("Error sending upcoming reminders:", error);
      throw error;
    }
  }
}

module.exports = new ReminderService();