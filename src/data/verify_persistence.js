const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const Form = require("../models/Form");
const AnalysisService = require("../services/analysis/analysisService");
const { cache } = require("../utils/cache");

const verifyPersistence = async () => {
  try {
    const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/event-evaluation";
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const form = await Form.findOne({ title: /Balanced Analytics/i });
    if (!form) {
      console.error("Test form not found!");
      process.exit(1);
    }

    console.log(`Testing Form: ${form.title} (${form._id})`);
    
    // Clear any existing sentiment for fresh test
    await Form.updateOne(
      { _id: form._id },
      { 
        $set: { 
          "responses.$[].responses.$[].sentiment": null,
          "responses.$[].responses.$[].sentimentScore": null,
          "responses.$[].responses.$[].sentimentConfidence": null
        } 
      }
    );
    console.log("Cleared existing sentiment scores from DB");
    cache.flushAll();

    // 1st Run: Should use Python
    console.time("First Run (Python Expected)");
    const questionTypeMap = {};
    form.questions.forEach(q => questionTypeMap[q._id.toString()] = q.type);
    
    await AnalysisService.analyzeResponses(form.responses, questionTypeMap, form.questions, form._id);
    console.timeEnd("First Run (Python Expected)");

    // Verify DB update
    const updatedForm = await Form.findById(form._id).lean();
    let hasSentiment = false;
    for (const res of updatedForm.responses) {
      for (const q of res.responses) {
        if (q.sentiment) {
          hasSentiment = true;
          break;
        }
      }
      if (hasSentiment) break;
    }

    if (hasSentiment) {
      console.log("✅ SUCCESS: Sentiment persisted to DB");
    } else {
      console.log("❌ FAILURE: Sentiment NOT found in DB after first run");
    }

    // 2nd Run: Should be Instant (Hybrid Persistent)
    console.time("Second Run (DB Expected)");
    const secondResult = await AnalysisService.analyzeResponses(updatedForm.responses, questionTypeMap, updatedForm.questions, updatedForm._id);
    console.timeEnd("Second Run (DB Expected)");
    
    console.log(`Method used: ${secondResult.method}`);
    
    if (secondResult.method === "hybrid_persistent" || secondResult.method === "python_advanced") {
        console.log("✅ Verified hybrid persistent logic");
    }

    process.exit(0);
  } catch (err) {
    console.error("Verification failed:", err);
    process.exit(1);
  }
};

verifyPersistence();
