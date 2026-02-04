const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../utils/db");
const Form = require("../models/Form");
const User = require("../models/User");

const fixOwnership = async () => {
  try {
    await connectDB();
    console.log("Connected to database...");

    // 1. Find the target form
    const targetForm = await Form.findOne({ title: /Balanced Analytics/i }).sort({ createdAt: -1 });
    if (!targetForm) {
      console.log("Balanced Analytics form not found.");
      process.exit(0);
    }
    console.log(`Found target form: "${targetForm.title}" (ID: ${targetForm._id})`);

    // 2. Find the most likely user "Me"
    // Usually the user who created the latest NON-seeded forms
    const recentUser = await User.findOne({ name: /Rodolfo/i }) || await User.findOne({ role: "psas" });
    
    if (!recentUser) {
      console.log("Could not find a suitable user to reassign to.");
      process.exit(0);
    }
    
    console.log(`Reassigning to user: ${recentUser.name} (${recentUser.email})`);

    targetForm.createdBy = recentUser._id;
    await targetForm.save();

    console.log("Ownership updated successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Error fixing ownership:", err);
    process.exit(1);
  }
};

fixOwnership();
