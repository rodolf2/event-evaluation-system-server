const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");

async function diagnose() {
  try {
    const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/event-evaluation";
    console.log("Connecting to:", MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const Form = require("../models/Form");
    const AnalysisService = require("../services/analysis/analysisService");

    const form = await Form.findOne({ title: /Balanced Analytics/i });
    if (!form) {
      console.log("❌ Test form not found");
      process.exit(1);
    }

    console.log("Found Form:", form.title);
    
    // Check if fields exist in schema
    const firstResponse = form.responses[0];
    const firstAnswer = firstResponse.responses[0];
    console.log("Field check - sentiment:", firstAnswer.sentiment);
    console.log("Field check - score:", firstAnswer.sentimentScore);

    // Initial analysis (should populate DB)
    const questionTypeMap = {};
    form.questions.forEach(q => questionTypeMap[q._id.toString()] = q.type);
    
    console.log("Running analysis...");
    const result = await AnalysisService.analyzeResponses(form.responses, questionTypeMap, form.questions, form._id);
    console.log("Analysis Method Used:", result.method);
    
    // Fetch again and check
    const updatedForm = await Form.findById(form._id).lean();
    const sample = updatedForm.responses[0].responses.find(r => r.sentiment);
    if (sample) {
      console.log("✅ SUCCESS: Data found in DB!");
      console.log("Sample Data:", {
        text: sample.answer,
        sentiment: sample.sentiment,
        score: sample.sentimentScore
      });
    } else {
      console.log("❌ FAILURE: No sentiment data found in DB after analysis");
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("DIAGNOSTIC ERROR:", err);
    process.exit(1);
  }
}

diagnose();
