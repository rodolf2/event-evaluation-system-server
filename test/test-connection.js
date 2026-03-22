/**
 * Quick MongoDB Connection Test
 */
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "./.env") });

async function testConnection() {
  try {
    console.log("🔍 Testing MongoDB Atlas connection...");
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      console.error("❌ MONGODB_URI not found in .env");
      process.exit(1);
    }

    console.log(`📍 Connecting to: ${uri.substring(0, 60)}...`);

    const start = Date.now();
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    const elapsed = Date.now() - start;
    console.log(`✅ Connected in ${elapsed}ms`);

    // Try a simple operation
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    console.log(`✅ Found ${collections.length} collections`);

    // List report counts
    const Report = require("./src/models/Report");
    const total = await Report.countDocuments();
    console.log(`📊 Total Reports in Database: ${total}`);

    if (total === 0) {
      console.log("\n⚠️  NO REPORTS FOUND - Need to generate them!");
    } else {
      const published = await Report.countDocuments({ status: "published" });
      console.log(`   Published: ${published}`);
      console.log(`   Other: ${total - published}`);
    }

    await mongoose.disconnect();
    console.log("\n✅ Connection test complete!");
  } catch (error) {
    console.error("❌ Connection failed:", error.message);

    if (error.name === "MongooseError") {
      console.error("\n💡 Possible causes:");
      console.error(
        "   1. MongoDB Atlas cluster is paused→ Go to mongodb.com, sign in, resume cluster",
      );
      console.error(
        "   2. IP whitelist issue         → Add your IP to MongoDB Atlas",
      );
      console.error(
        "   3. Connection string invalid  → Check .env MONGODB_URI",
      );
      console.error(
        "   4. Network timeout           → Check internet connection",
      );
    }

    process.exit(1);
  }
}

testConnection().catch(console.error);
