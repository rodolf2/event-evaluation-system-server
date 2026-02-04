const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../utils/db");
const Form = require("../models/Form");

const fixDate = async () => {
    try {
        await connectDB();
        console.log("Connected to MongoDB.");

        const form = await Form.findOne({ title: "Seeded Evaluation Form 2025" });
        
        if (!form) {
            console.log("Form not found!");
            process.exit(1);
        }

        console.log(`Found form: ${form.title}`);
        console.log(`Current createdAt: ${form.createdAt}`);

        // Set date to exactly 1 year ago
        const newDate = new Date();
        newDate.setFullYear(newDate.getFullYear() - 1);
        
        // Mongoose might override createdAt on save if not careful, 
        // but typically direct assignment works if timestamps: true doesn't block it.
        // To be safe, we can use updateOne.
        
        await Form.updateOne(
            { _id: form._id },
            { $set: { createdAt: newDate } }
        );

        const updatedForm = await Form.findById(form._id);
        console.log(`New createdAt: ${updatedForm.createdAt}`);
        
        console.log("Date update complete.");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

fixDate();
