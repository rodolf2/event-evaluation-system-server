const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../utils/db");

const seedCleanupAndComparison = async () => {
  try {
    await connectDB();
    console.log("Connected to Database!");

    const Form = require("../models/Form");

    // Delete ALL forms with "200 Attendees" or "500 Attendees" in the title to clean up
    console.log("🧹 Cleaning up duplicate forms...");
    const result = await Form.deleteMany({
      title: { $regex: "(200|500) Attendees", $options: "i" },
    });
    console.log(`✅ Deleted ${result.deletedCount} form(s)\n`);

    console.log(
      "✅ Cleanup complete! Now run seed_500_attendees_comparison.js again",
    );
    process.exit(0);
  } catch (error) {
    console.error("Error during cleanup:", error);
    process.exit(1);
  }
};

seedCleanupAndComparison();
