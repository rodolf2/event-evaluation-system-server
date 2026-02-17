require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const connectDB = require("../src/utils/db");
const Form = require("../src/models/Form");
const User = require("../src/models/User");
const Feedback = require("../src/models/Feedback"); // Added Feedback model

// Configuration
const BASE_TITLE = "Annual Student Evaluation";
const DEPARTMENTS = ["Higher Education", "Basic Education", "IT Department", "Business Dept", "Nursing", "Engineering"];
const PROGRAMS = ["BSCS", "BSIS", "ACT", "BSA", "BSN", "BSECE", "Grade 12", "Grade 11"];

// Expanded Comment Pools
const COMMENTS = {
  positive: [
    "Great event! Learned a lot.",
    "The speakers were very knowledgeable and engaging.",
    "Excellent organization and venue.",
    "I really enjoyed the breakout sessions.",
    "The food was delicious and plentiful.",
    "Very well timed and structured.",
    "The topics were very relevant to my course.",
    "I would definitely attend again next year.",
    "Great opportunity to network with other students.",
    "Testing the system with a positive review."
  ],
  neutral: [
    "It was okay, but could be improved.",
    "The event was average.",
    "Some speakers were good, others were boring.",
    "Investigating the flow of the event.",
    "The venue was fine, but a bit far.",
    "Just submitting for compliance.",
    "Networking was okay.",
    "Food was standard catering.",
    "Timings were a bit off.",
    "Overall, a decent experience."
  ],
  negative: [
    "started late and ended late.",
    "The venue was too hot and crowded.",
    "Poor audio quality, couldn't hear the speaker.",
    "The topics were irrelevant.",
    "Food ran out quickly.",
    "Registration process was chaotic.",
    "Waste of time.",
    "I didn't learn anything new.",
    "The speakers were unprepared.",
    "System crash simulation comment."
  ]
};

// Helper to generate random date
const randomDate = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

// Helper to get random item from array
const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Helper to get weighted random rating
// weight: 'high' (mostly 4-5), 'low' (mostly 1-3), 'mixed' (random)
const getWeightedRating = (weight) => {
  const rand = Math.random();
  if (weight === 'high') {
    return rand < 0.7 ? getRandom([5, 5, 4]) : getRandom([3, 4]);
  } else if (weight === 'low') {
    return rand < 0.7 ? getRandom([1, 2, 2]) : getRandom([3, 1]);
  } else {
    return getRandom([1, 2, 3, 4, 5]);
  }
};

const seed = async () => {
  try {
    await connectDB();
    console.log("Connected to MongoDB for seeding...");

    // Find a creator user
    const targetEmail = "rodolfojrebajan@student.laverdad.edu.ph";
    let creator = await User.findOne({ email: targetEmail });
    
    if (!creator) {
        console.warn(`User ${targetEmail} not found. Falling back to PSAS role or first available user.`);
        creator = await User.findOne({ role: "psas" }) || await User.findOne();
    }
    
    if (!creator) {
      console.error("No user found to create forms. Please seed users first.");
      process.exit(1);
    }
    console.log(`Creating forms as user: ${creator.email}`);

    // --- 1. Create Previous Year Event (2024) ---
    console.log("Creating 2024 Event...");
    const form2024 = await createEventForm(
      creator._id,
      `${BASE_TITLE}`,
      new Date("2024-05-15"),
      new Date("2024-05-16")
    );
    
    // Add attendees and responses for 2024
    // Scenario: High satisfaction (Benchmark)
    await populateEventData(form2024, {
      count: 45, 
      sentimentBias: 'positive',
      departments: ["Higher Education", "IT Department"], 
      programs: ["BSCS", "BSIS"]
    });

    // --- 2. Create Current Year Event (2025) ---
    console.log("Creating 2025 Event...");
    const form2025 = await createEventForm(
      creator._id,
      `${BASE_TITLE}`, // Same title for linking
      new Date("2025-05-15"),
      new Date("2025-05-16")
    );

    // Add attendees and responses for 2025
    // Scenario: Mixed/Lower satisfaction (Needs Improvement)
    await populateEventData(form2025, {
        count: 60,
        sentimentBias: 'mixed', // Mix of positive, neutral, negative
        departments: ["Higher Education", "IT Department", "Business Dept"],
        programs: ["BSCS", "BSIS", "BSA"]
    });

    console.log("\n=================================");
    console.log("SEEDING COMPLETE");
    console.log("=================================");
    console.log(`Previous Event (2024) ID: ${form2024._id}`);
    console.log(`Current Event (2025) ID:  ${form2025._id}`);
    console.log("=================================");
    console.log("Use the Current Event ID to check the report and verify comparison.");

    process.exit(0);

  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
};

async function createEventForm(userId, title, startDate, endDate) {
    // Create Form
    const newForm = new Form({
        title: title,
        description: "Annual evaluation for student satisfaction and feedback.",
        createdBy: userId,
        status: "published",
        eventStartDate: startDate,
        eventEndDate: endDate,
        publishedAt: new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000), // 1 week before
        createdAt: new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000), // Set creation date to match publication
        updatedAt: new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000),
        questions: [
            {
                questionId: "q1",
                title: "How satisfied were you with the event?",
                type: "scale",
                low: 1,
                high: 5,
                lowLabel: "Dissatisfied",
                highLabel: "Satisfied",
                required: true
            },
            {
                questionId: "q2",
                title: "What did you like or dislike?",
                type: "paragraph",
                required: false
            }
        ]
    });
    return await newForm.save({ timestamps: false }); // Bypass automatic timestamps
}

async function populateEventData(form, config) {
    const attendees = [];
    const dbResponses = [];
    const feedbackDocs = []; // Array for Feedback documents
    
    for (let i = 0; i < config.count; i++) {
        // Use consistent naming for potential linking if we simulate same students
        const email = `student${i}_${config.departments[0].substring(0,2)}@test.com`;
        
        // Dynamic Columns
        const dept = getRandom(config.departments);
        const prog = getRandom(config.programs);

        // Add to attendee list
        attendees.push({
            name: `Student ${i}`,
            email: email,
            Department: dept, // Dynamic Column 1
            Program: prog,    // Dynamic Column 2
            uploadedAt: new Date(),
            hasResponded: true 
        });

        // Determine sentiment for this specific response
        let sentiment;
        let ratingWeight;
        
        if (config.sentimentBias === 'positive') {
             // 80% positive, 10% neutral, 10% negative
             const r = Math.random();
             if (r < 0.8) { sentiment = 'positive'; ratingWeight = 'high'; }
             else if (r < 0.9) { sentiment = 'neutral'; ratingWeight = 'mixed'; }
             else { sentiment = 'negative'; ratingWeight = 'low'; }
        } else if (config.sentimentBias === 'mixed') {
            // 40% positive, 30% neutral, 30% negative
             const r = Math.random();
             if (r < 0.4) { sentiment = 'positive'; ratingWeight = 'high'; }
             else if (r < 0.7) { sentiment = 'neutral'; ratingWeight = 'mixed'; }
             else { sentiment = 'negative'; ratingWeight = 'low'; }
        } else {
             // Negative bias
             const r = Math.random();
             if (r < 0.2) { sentiment = 'positive'; ratingWeight = 'high'; }
             else if (r < 0.4) { sentiment = 'neutral'; ratingWeight = 'mixed'; }
             else { sentiment = 'negative'; ratingWeight = 'low'; }
        }

        const rating = getWeightedRating(ratingWeight);
        const comment = getRandom(COMMENTS[sentiment]);

        // Add Response (Form Model)
        dbResponses.push({
            respondentEmail: email,
            respondentName: `Student ${i}`,
            submittedAt: randomDate(form.eventStartDate, form.eventEndDate),
            responses: [
                {
                    questionId: "q1",
                    questionTitle: "How satisfied were you with the event?",
                    answer: rating
                },
                {
                    questionId: "q2",
                    questionTitle: "What did you like or dislike?",
                    answer: comment
                }
            ]
        });

        // Add Feedback (Feedback Model) - for compatibility with older analysis tools
        // We need a userId. Since these are "fake" students who might not exist in User collection,
        // we might run into validation issues if Feedback requires a valid User ObjectId.
        // Let's check if Feedback requires valid refs.
        // If Feedback.userId is required and must strictly be an ObjectId of a User, we'd need Users.
        // However, usually Mongoose only validates the type (ObjectId). 
        // To be safe, let's just use the form creator's ID if we can't find a user, 
        // OR better, we simply won't create Feedback if we can't guarantee a User.
        // BUT the requirement was to Populate Feedback.
        // Start: We will create a fake ObjectId for the user if they don't exist.
        // Wait, Mongoose checks only format. 
        // To be safer and cleaner: logic should be "If we want Feedback, we should probably Create Users".
        // BUT that slows down the seed.
        // Alternative: Use the creator ID for all feedbacks (as a placeholder), 
        // or create 1 dummy student user and assign all feedback to them (bad for unique counts).
        // Best approach for this script: Use a generated objectId.
        const fakeUserId = new mongoose.Types.ObjectId(); 
        
        feedbackDocs.push({
            eventId: form._id, // NOTE: Event in Feedback usually refers to an Event document, NOT the Form.
                               // In the reportController, we saw it tries to find an Event with the same name as the Form.
                               // We need to ensure that Event document exists?
                               // FormsController lines 1615-1626 creates an Event if it doesn't exist when generating certificates.
                               // We should create a shadow Event document to link Feedback to.
            userId: fakeUserId,
            rating: rating,
            comment: comment,
            comment: comment,
            createdAt: randomDate(form.eventStartDate, form.eventEndDate) // Match event timeframe
        });
    }

    // Shadow Event Creation (for Feedback linkage)
    // The system seems to treat Forms and Events somewhat loosely or linked by name.
    // analysisService.generateQuantitativeReport looks up Event by ID.
    // If we want that service to work, we need an Event document that matches.
    // However, the `form._id` is often passed as `eventId` in some contexts.
    // Let's check `analysisService.js` line 934: `const currentEvent = await Event.findById(eventId);`
    // So `eventId` passed to `generateQuantitativeReport` MUST be an Event ID.
    // If we pass `form._id` to it, it will fail unless Form and Event share ID (impossible).
    // SO: We must create an Event document and use THAT ID for Feedback.
    
    // Create matching Event document
    const Event = require("../src/models/Event");
    let eventDoc = await Event.findOne({ name: form.title, date: form.eventStartDate });
    if (!eventDoc) {
        eventDoc = new Event({
            name: form.title,
            date: form.eventStartDate,
            endDate: form.eventEndDate,
            description: form.description,
            createdAt: form.createdAt, // Match form creation date
            // Add other required fields if any
        });
        await eventDoc.save({ timestamps: false });
        console.log(`Created shadow Event document: ${eventDoc._id} for Form: ${form._id}`);
    }

    // Update Feedback docs with real Event ID
    feedbackDocs.forEach(fb => fb.eventId = eventDoc._id);

    // Save Form updates
    form.attendeeList = attendees;
    form.responses = dbResponses;
    form.responseCount = dbResponses.length;
    await form.save();

    // Save Feedbacks
    if (feedbackDocs.length > 0) {
        await Feedback.insertMany(feedbackDocs);
        console.log(`Created ${feedbackDocs.length} Feedback documents for compatibility.`);
    }
}

seed();
