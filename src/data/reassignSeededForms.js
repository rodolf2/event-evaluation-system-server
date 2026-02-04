const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../utils/db");
const Form = require("../models/Form");

const reassignForms = async () => {
    try {
        await connectDB();
        console.log("Connected to MongoDB.");

        // Target User: Rodolfo Ebajan Jr.
        const targetUserId = "696f7a7ed0243342ef59a558";

        const forms = await Form.find({ 
            title: { $regex: /Seeded Evaluation Form/ } 
        });

        console.log(`Found ${forms.length} seeded forms.`);

        for (const form of forms) {
            form.createdBy = targetUserId;
            await form.save();
            console.log(`Updated form "${form.title}" to be owned by user ${targetUserId}`);
        }

        console.log("Reassignment complete.");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

reassignForms();
