const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../utils/db");
const Form = require("../models/Form");
const User = require("../models/User");

const reassignToUser = async () => {
  try {
    await connectDB();
    console.log("Connected to database...");

    // Target User ID from terminal logs
    const targetUserId = "696f7a7ed0243342ef59a558";
    const user = await User.findById(targetUserId);

    if (!user) {
      console.log(`User with ID ${targetUserId} not found. Searching for 'Rodolfo'...`);
      const backupUser = await User.findOne({ name: /Rodolfo/i });
      if (!backupUser) {
        console.error("Could not find the target user.");
        process.exit(1);
      }
      return reassign(backupUser);
    }

    await reassign(user);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
};

async function reassign(user) {
  const result = await Form.updateMany(
    { title: /Balanced Analytics/i },
    { $set: { createdBy: user._id } }
  );

  console.log(`Matched ${result.matchedCount}, Modified ${result.modifiedCount}`);
  console.log(`Updated form(s) to be owned by: ${user.name} (${user.email})`);
  process.exit(0);
}

reassignToUser();
