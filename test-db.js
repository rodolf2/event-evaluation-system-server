const mongoose = require("mongoose");
const dns = require("dns").promises;
require("dotenv").config();

// Set DNS resolution to use Google's DNS
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const testConnection = async () => {
    console.log("Starting DB connection test...");
    console.log("URI:", process.env.MONGODB_URI.replace(/\/\/.*@/, "//USER:PASS@"));

    try {
        const start = Date.now();
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
            family: 4
        });
        console.log(`Connected successfully in ${Date.now() - start}ms`);

        // Try a simple operation
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        console.log("Collections count:", collections.length);

        console.log("Waiting 5 seconds to see if connection drops...");
        await new Promise(resolve => setTimeout(resolve, 5000));

        const collectionsAgain = await db.listCollections().toArray();
        console.log("Connection still alive. Collections count:", collectionsAgain.length);

        await mongoose.disconnect();
        console.log("Disconnected successfully");
    } catch (error) {
        console.error("Test failed!");
        console.error("Error Name:", error.name);
        console.error("Error Message:", error.message);
        if (error.cause) {
            console.error("Error Cause:", error.cause);
        }
    }
};

testConnection();
