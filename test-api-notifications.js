/**
 * Direct API test for notifications endpoint
 */
const mongoose = require("mongoose");
require("dotenv").config();

const Notification = require("./src/models/Notification");
const User = require("./src/models/User");

async function testAPI() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB\n");

    // Get a participant user
    const participant = await User.findOne({ role: "participant" });
    if (!participant) {
      console.error("❌ No participant user found");
      return;
    }

    console.log(
      "Testing for user:",
      participant.name,
      "(",
      participant.role,
      ")"
    );
    console.log("User ID:", participant._id);
    console.log("");

    // Simulate the visibility filter from the controller
    const userId = participant._id;
    const userRole = participant.role;

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

    console.log("Visibility Filter:");
    console.log(JSON.stringify(visibilityFilter, null, 2));
    console.log("");

    // Run the query
    const notifications = await Notification.find(visibilityFilter)
      .populate("createdBy", "name")
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${notifications.length} notifications`);
    console.log("");

    if (notifications.length > 0) {
      console.log("📋 First 5 Notifications:");
      notifications.slice(0, 5).forEach((notif, idx) => {
        console.log(`\n${idx + 1}. ${notif.title}`);
        console.log(`   ID: ${notif._id}`);
        console.log(`   Type: ${notif.type}`);
        console.log(`   Priority: ${notif.priority}`);
        console.log(`   Target Roles: [${notif.targetRoles.join(", ")}]`);
        console.log(`   Created By: ${notif.createdBy?.name || "System"}`);
        console.log(
          `   Created At: ${new Date(notif.createdAt).toLocaleString()}`
        );
      });
    } else {
      console.log("❌ No notifications found for this user");

      // Debug: show what's in the database
      console.log("\n🔍 Debug Info:");
      const allNotifs = await Notification.find()
        .sort({ createdAt: -1 })
        .limit(5);
      console.log(
        `Total notifications in DB: ${await Notification.countDocuments()}`
      );
      console.log("Latest 5 notifications and their targetRoles:");
      allNotifs.forEach((n) => {
        console.log(
          `- ${n.title.substring(
            0,
            40
          )}... | targetRoles: [${n.targetRoles.join(", ")}]`
        );
      });
    }
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

testAPI();
