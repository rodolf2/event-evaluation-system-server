/**
 * Test script to verify notification creation flow
 * This connects to MongoDB directly and checks if notifications are being saved
 */

const mongoose = require("mongoose");
require("dotenv").config();

const Notification = require("./src/models/Notification");
const Reminder = require("./src/models/Reminder");
const User = require("./src/models/User");

async function testNotifications() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Find the most recent notifications
    const recentNotifications = await Notification.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("createdBy", "name email role");

    console.log("\n📋 Recent Notifications (last 10):");
    console.log(
      "Total notifications in DB:",
      await Notification.countDocuments()
    );
    recentNotifications.forEach((notif, idx) => {
      console.log(`\n${idx + 1}. ${notif.title}`);
      console.log(`   Type: ${notif.type}`);
      console.log(`   Target Roles: ${notif.targetRoles.join(", ")}`);
      console.log(`   Created By: ${notif.createdBy?.name || "System"}`);
      console.log(`   Created At: ${notif.createdAt}`);
      console.log(`   Expires At: ${notif.expiresAt || "Never"}`);
    });

    // Find recent reminders
    const recentReminders = await Reminder.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("userId", "name email role");

    console.log("\n\n📌 Recent Reminders (last 5):");
    console.log("Total reminders in DB:", await Reminder.countDocuments());
    recentReminders.forEach((reminder, idx) => {
      console.log(`\n${idx + 1}. ${reminder.title}`);
      console.log(`   Creator: ${reminder.userId?.name || "Unknown"}`);
      console.log(`   Date: ${reminder.date}`);
      console.log(`   Priority: ${reminder.priority}`);
      console.log(`   Completed: ${reminder.completed}`);
      console.log(`   Created At: ${reminder.createdAt}`);
    });

    // Check if there are any users with role 'participant'
    const participantCount = await User.countDocuments({ role: "participant" });
    const psasCount = await User.countDocuments({ role: "psas" });
    const adminCount = await User.countDocuments({ role: "school-admin" });
    console.log("\n\n👥 User Count by Role:");
    console.log(`Participants: ${participantCount}`);
    console.log(`PSAS: ${psasCount}`);
    console.log(`School Admin: ${adminCount}`);

    // Test a query to see what a participant would see
    if (participantCount > 0) {
      const participant = await User.findOne({ role: "participant" });
      console.log(
        `\n\n🔍 Testing notification visibility for participant: ${participant.name}`
      );

      const visibleNotifications = await Notification.find({
        $and: [
          {
            $or: [
              { targetRoles: "participant" },
              { targetUsers: participant._id },
            ],
          },
          {
            $or: [
              { expiresAt: { $exists: false } },
              { expiresAt: { $gt: new Date() } },
            ],
          },
        ],
      }).sort({ createdAt: -1 });

      console.log(
        `Notifications visible to this participant: ${visibleNotifications.length}`
      );
      visibleNotifications.slice(0, 3).forEach((notif) => {
        console.log(`- ${notif.title} (${notif.type})`);
      });
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

testNotifications();
