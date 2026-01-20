require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const connectDB = require("../src/utils/db");
const User = require("../src/models/User");

const migrateRoles = async () => {
  try {
    await connectDB();
    console.log("Connected to MongoDB for migration...");

    // Update 'participant' to 'student'
    const participantResult = await User.updateMany(
      { role: "participant" },
      { $set: { role: "student" } },
    );
    console.log(
      `Updated ${participantResult.modifiedCount} users from 'participant' to 'student'`,
    );

    // Update 'school-admin' to 'senior-management'
    const adminResult = await User.updateMany(
      { role: "school-admin" },
      { $set: { role: "senior-management" } },
    );
    console.log(
      `Updated ${adminResult.modifiedCount} users from 'school-admin' to 'senior-management'`,
    );

    console.log("Migration completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

migrateRoles();
