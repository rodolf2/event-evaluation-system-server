const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../utils/db");
const Event = require("../models/Event");
const Feedback = require("../models/Feedback");
const Form = require("../models/Form");

const verifyClean = async () => {
  try {
    await connectDB();
    
    console.log("Verifying database state...");

    const feedbackCount = await Feedback.countDocuments({});
    console.log(`Feedbacks: ${feedbackCount}`);

    const eventCount = await Event.countDocuments({});
    console.log(`Events: ${eventCount}`);

    const formsWithResponses = await Form.countDocuments({ $or: [{ responses: { $not: { $size: 0 } } }, { responseCount: { $gt: 0 } }] });
    console.log(`Forms with responses: ${formsWithResponses}`);

    if (feedbackCount === 0 && eventCount === 0 && formsWithResponses === 0) {
        console.log("VERIFICATION PASSED: Database is clean.");
    } else {
        console.log("VERIFICATION FAILED: Database still contains data.");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("Error verifying database:", error);
    process.exit(1);
  }
};

verifyClean();
