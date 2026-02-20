require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const connectDB = require("../src/utils/db");
const Form = require("../src/models/Form");
const Event = require("../src/models/Event");
const Report = require("../src/models/Report");
const Feedback = require("../src/models/Feedback");

const cleanup = async () => {
    try {
        await connectDB();
        console.log("Connected to MongoDB for cleanup...");

        const titlePattern = /Grand University Summit/;
        
        console.log("Finding items to delete...");

        // 1. Delete Forms
        const forms = await Form.find({ title: titlePattern });
        const formIds = forms.map(f => f._id);
        console.log(`Found ${forms.length} forms to delete.`);
        
        if (forms.length > 0) {
            await Form.deleteMany({ _id: { $in: formIds } });
            console.log("Deleted forms.");
        }

        // 2. Delete Events (Shadow events)
        const events = await Event.find({ name: titlePattern });
        const eventIds = events.map(e => e._id);
        console.log(`Found ${events.length} events to delete.`);
        
        if (events.length > 0) {
            await Event.deleteMany({ _id: { $in: eventIds } });
            console.log("Deleted events.");
        }

        // 3. Delete Reports
        // Reports linked to deleted forms
        const reports = await Report.find({ formId: { $in: formIds } });
        console.log(`Found ${reports.length} reports to delete.`);
        
        if (reports.length > 0) {
            await Report.deleteMany({ formId: { $in: formIds } });
            console.log("Deleted reports.");
        }

        // 4. Delete Feedbacks
        // Feedbacks linked to deleted events
        // Note: Feedbacks might be large, use deleteMany directly
        const feedbackDeleteResult = await Feedback.deleteMany({ eventId: { $in: eventIds } });
        console.log(`Deleted ${feedbackDeleteResult.deletedCount} feedbacks.`);

        console.log("\nCleanup complete.");
        process.exit(0);

    } catch (err) {
        console.error("Cleanup failed:", err);
        process.exit(1);
    }
};

cleanup();
