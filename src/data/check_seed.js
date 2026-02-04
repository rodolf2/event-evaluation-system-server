const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../utils/db");
const Form = require("../models/Form");
const User = require("../models/User");

const checkData = async () => {
  try {
    await connectDB();
    console.log("Connected to database...");

    const forms = await Form.find({ title: /Balanced Analytics/i })
      .select("title createdBy status createdAt")
      .populate("createdBy", "name email role")
      .lean();

    if (forms.length === 0) {
      console.log("No forms found with 'Balanced Analytics' in the title.");
      
      // Let's check recent forms anyway
      const recentForms = await Form.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .select("title createdBy status createdAt")
        .populate("createdBy", "name email role")
        .lean();
        
      console.log("\nRecent 5 forms in DB:");
      recentForms.forEach(f => {
        console.log(`- ID: ${f._id} | Title: "${f.title}" | Owner: ${f.createdBy?.name || 'Unknown'} (${f.createdBy?.email || 'N/A'}) | Created: ${f.createdAt}`);
      });

    } else {
      console.log(`Found ${forms.length} form(s):`);
      forms.forEach(f => {
        console.log(`- ID: ${f._id} | Title: "${f.title}" | Owner: ${f.createdBy?.name || 'Unknown'} (${f.createdBy?.email || 'N/A'}) | Role: ${f.createdBy?.role || 'N/A'}`);
      });
    }

    process.exit(0);
  } catch (err) {
    console.error("Error checking data:", err);
    process.exit(1);
  }
};

checkData();
