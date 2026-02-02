const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const connectDB = require("../utils/db");
const Report = require("../models/Report");

async function inspect() {
  await connectDB();
  console.log("Connected to DB");

  const reports = await Report.find({
    title: { $in: ["Foundation Day 2025", "Foundation Day 2026"] }
  }).select("title thumbnail formId");

  console.log("\n--- Seeded Reports Thumbnail Paths ---");
  reports.forEach(r => {
    console.log(`Title: ${r.title}`);
    console.log(`Thumbnail: ${r.thumbnail}`);
    console.log(`FormID: ${r.formId}`);
    console.log('---');
  });

  process.exit(0);
}

inspect().catch(console.error);
