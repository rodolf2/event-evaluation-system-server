const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const { cache } = require("../utils/cache");

const clearCache = async () => {
  try {
    console.log("Clearing all cache...");
    cache.flushAll();
    console.log("Cache cleared successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Error clearing cache:", err);
    process.exit(1);
  }
};

clearCache();
