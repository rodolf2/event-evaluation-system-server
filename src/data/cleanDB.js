const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../utils/db");
const Event = require("../models/Event");
const Feedback = require("../models/Feedback");
const Form = require("../models/Form");

const cleanDB = async () => {
  try {
    await connectDB();
    
    console.log("Starting database cleanup...");

    const feedbackResult = await Feedback.deleteMany({});
    console.log(`Deleted ${feedbackResult.deletedCount} feedbacks.`);

    const eventResult = await Event.deleteMany({});
    console.log(`Deleted ${eventResult.deletedCount} events.`);

    const formResult = await Form.updateMany({}, { $set: { responses: [], responseCount: 0 } });
    console.log(`Cleared responses from ${formResult.modifiedCount} forms.`);

    console.log("Database cleanup complete.");
    process.exit(0);
  } catch (error) {
    console.error("Error cleaning database:", error);
    process.exit(1);
  }
};

cleanDB();
