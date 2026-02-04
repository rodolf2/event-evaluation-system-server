const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../utils/db");
const Form = require("../models/Form");

const verifySeed = async () => {
  try {
    console.log("Checking environment...");
    if (!process.env.MONGODB_URI) {
        console.error("❌ MONGODB_URI is not defined in process.env");
        console.log("Current directory:", __dirname);
        console.log("Dotenv path:", path.resolve(__dirname, "../../.env"));
        process.exit(1);
    } else {
        console.log("✅ MONGODB_URI is defined");
    }

    console.log("Connecting to MongoDB...");
    await connectDB();
    console.log("Connected to MongoDB for verification");

    const form = await Form.findOne({ title: "Seeded Event Evaluation (Customer Request)" });
    
    if (!form) {
        console.log("❌ Form not found.");
        process.exit(0);
    }

    console.log(`✅ Form found: ${form.title}`);
    console.log(`- Total Responses: ${form.responseCount} (Expected: 500)`);
    console.log(`- Total Attendees: ${form.attendeeList.length} (Expected: 500)`);

    // Check specific counts if possible
    const responses = form.responses;
    // ... logic to verify sentiments if needed ...
    
    process.exit(0);
  } catch (error) {
    console.error("Error verifying:", error);
    process.exit(1);
  }
};

verifySeed();
