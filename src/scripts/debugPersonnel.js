const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// Load env vars
dotenv.config({ path: path.join(__dirname, "../../.env") });

const Personnel = require("../models/Personnel");
const connectDB = require("../utils/db");

async function checkPersonnel() {
  try {
    console.log("Connecting to DB...");
    await connectDB();

    console.log("Fetching all personnel...");
    const allPersonnel = await Personnel.find({});
    console.log(`Total personnel found: ${allPersonnel.length}`);

    const activePersonnel = await Personnel.find({ isActive: true });
    console.log(`Active personnel found: ${activePersonnel.length}`);

    const inactivePersonnel = await Personnel.find({ isActive: false });
    console.log(`Inactive personnel found: ${inactivePersonnel.length}`);

    const undefinedActive = await Personnel.find({
      isActive: { $exists: false },
    });
    console.log(`Personnel with undefined isActive: ${undefinedActive.length}`);

    if (allPersonnel.length > 0) {
      console.log(
        "Sample personnel:",
        JSON.stringify(allPersonnel[0], null, 2)
      );
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

checkPersonnel();
