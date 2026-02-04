const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../utils/db");
const Form = require("../models/Form");
const User = require("../models/User");

const debugDB = async () => {
    try {
        await connectDB();
        console.log("Connected to MongoDB.");

        console.log("\n--- USERS ---");
        const users = await User.find({}).select("name email role _id position");
        users.forEach(u => console.log(`ID: ${u._id} | Name: ${u.name} | Email: ${u.email} | Role: ${u.role}`));

        console.log("\n--- FORMS ---");
        const forms = await Form.find({}).select("title createdBy status _id createdAt");
        forms.forEach(f => {
            const creator = users.find(u => u._id.toString() === f.createdBy.toString());
            const creatorName = creator ? creator.name : "UNKNOWN";
            console.log(`ID: ${f._id} | Title: "${f.title}" | Status: ${f.status} | CreatedBy: ${creatorName} (${f.createdBy})`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

debugDB();
