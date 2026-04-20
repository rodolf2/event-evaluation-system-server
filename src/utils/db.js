const mongoose = require("mongoose");
const dns = require("dns").promises;

// Set DNS resolution to use Google's DNS to bypass local DNS issues
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const normalizeMongoUri = (rawUri = "") => {
  // Render env values can accidentally include wrapping quotes or line breaks.
  const cleaned = rawUri.replace(/[\r\n\t ]+/g, "").replace(/^['"]|['"]$/g, "");
  return cleaned;
};

const connectDB = async () => {
  try {
    const mongoUri = normalizeMongoUri(process.env.MONGODB_URI);

    if (!mongoUri) {
      throw new Error("MONGODB_URI is missing");
    }

    await mongoose.connect(mongoUri);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    console.error(
      "MONGODB_URI check: make sure Render value is a single-line Atlas URI with the correct cluster host.",
    );
    process.exit(1);
  }
};

module.exports = connectDB;
