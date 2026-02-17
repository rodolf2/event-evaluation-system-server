const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");

const testConnection = async () => {
  console.log("Attempting to connect to MongoDB...");
  console.log("URI:", process.env.MONGODB_URI ? "Defined" : "Undefined");
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log("✅ MongoDB connected successfully");
    await mongoose.connection.close();
    console.log("Connection closed.");
    process.exit(0);
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

testConnection();
