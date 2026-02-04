const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../utils/db");

const forceFixDate = async () => {
    try {
        await connectDB();
        console.log("Connected to MongoDB.");
        
        // Use raw collection access to bypass Mongoose timestamps middleware
        const collection = mongoose.connection.db.collection("forms");

        const form = await collection.findOne({ title: "Seeded Evaluation Form 2025" });
        
        if (!form) {
            console.log("Form not found!");
            process.exit(1);
        }

        console.log(`Found form: ${form.title}`);
        console.log(`Current createdAt: ${form.createdAt}`);

        const newDate = new Date();
        newDate.setFullYear(newDate.getFullYear() - 1);
        console.log(`Target date: ${newDate}`);

        const result = await collection.updateOne(
            { _id: form._id },
            { $set: { createdAt: newDate } }
        );

        console.log(`Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);

        const updatedForm = await collection.findOne({ _id: form._id });
        console.log(`New createdAt: ${updatedForm.createdAt}`);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

forceFixDate();
