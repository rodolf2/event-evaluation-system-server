const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../utils/db");
const Form = require("../models/Form");
const User = require("../models/User");
const AnalyticsCacheService = require("../services/analysis/analyticsCacheService");

// Configuration
const TITLE = "Foundation Week 2025 and 2026 Celebration";
const TOTAL_ATTENDEES = 500;
const RESPONSE_COUNT = 439;
const POSITIVE_COUNT = 23;
const NEUTRAL_COUNT = 10;
const NEGATIVE_COUNT = 5;

const DEPARTMENTS = ["Basic Education", "Higher Education"];
const PROGRAMS = {
  "Basic Education": ["STEM", "GAS", "ICT", "HUMSS"],
  "Higher Education": ["BSIS", "ACT", "BSA", "BSAIS", "BAB", "BSSW"],
};
const YEAR_LEVELS = {
  "Basic Education": ["Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"],
  "Higher Education": ["1st Year", "2nd Year", "3rd Year", "4th Year"],
};

const POSITIVE_COMMENTS = [
  "Foundation Week was amazing! Loved the activities.",
  "Great job LVCC! The events were very well coordinated.",
  "Excellent experience. The foundation celebration gets better every year.",
  "So happy to be part of the 2025-2026 Foundation Week!",
  "The performances were world-class. Bravo to all participants!",
];

const NEUTRAL_COMMENTS = [
  "The event was okay, but some parts were a bit crowded.",
  "Good attempt at the Foundation Week celebration.",
  "Satisfactory activities, though I expected more variety.",
  "Organized reasonably well. Typical foundation week experience.",
  "Fine event. Some sessions were better than others.",
];

const NEGATIVE_COMMENTS = [
  "The field was too hot and crowded. Better ventilation needed.",
  "Many activities started late. Hope next year is better.",
  "Disappointed with the sound system quality in the gymnasium.",
  "Too many people for a small venue. Felt uncomfortable.",
  "The schedule was confusing at times.",
];

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

const generateEmail = (index) => `student${index}.${Math.floor(Math.random() * 10000)}@student.lvcc.edu.ph`;

const seedData = async () => {
  try {
    await connectDB();
    console.log("Connected to MongoDB.");

    // Delete existing form with the same title to avoid duplicates
    await Form.deleteOne({ title: TITLE });
    console.log(`Cleared existing form: ${TITLE}`);

    // Get a creator
    let creator = await User.findOne({ role: "psas" });
    if (!creator) creator = await User.findOne({ role: "admin" });
    if (!creator) {
      creator = await User.create({
        name: "Admin User",
        email: "admin@test.com",
        role: "psas",
        googleId: "admin_seed_123"
      });
    }

    const eventDate = new Date();
    eventDate.setFullYear(2026);

    // Create Form with questions
    const questions = [];
    // 6 Quantitative questions
    for (let i = 1; i <= 6; i++) {
      questions.push({
        _id: new mongoose.Types.ObjectId(),
        title: `Quantitative Rating Question ${i}`,
        type: "scale",
        required: true,
        low: 1,
        high: 5,
        sectionId: "main"
      });
    }
    // 1 Qualitative question
    const qualitativeQuestionId = new mongoose.Types.ObjectId();
    questions.push({
      _id: qualitativeQuestionId,
      title: "Please share your comments/suggestions about the Foundation Week Celebration.",
      type: "paragraph",
      required: true,
      sectionId: "main"
    });

    const form = new Form({
      title: TITLE,
      description: "Annual Foundation Week Celebration for 2025 and 2026.",
      status: "published",
      type: "evaluation",
      createdBy: creator._id,
      publishedAt: eventDate,
      eventStartDate: eventDate,
      eventEndDate: eventDate,
      questions: questions,
      attendeeList: [],
      responses: []
    });

    // Generate Attendees
    const attendees = [];
    for (let i = 0; i < TOTAL_ATTENDEES; i++) {
      const dept = i < TOTAL_ATTENDEES / 2 ? "Basic Education" : "Higher Education";
      const program = getRandomElement(PROGRAMS[dept]);
      const year = getRandomElement(YEAR_LEVELS[dept]);
      
      attendees.push({
        name: `Student Attendee ${i}`,
        email: generateEmail(i),
        department: dept,
        program,
        yearLevel: year,
        hasResponded: i < RESPONSE_COUNT // First 439 responded
      });
    }

    // Generate Responses
    const responses = [];
    const sentimentBreakdown = [
      { type: 'positive', count: POSITIVE_COUNT, rating: 5, comments: POSITIVE_COMMENTS },
      { type: 'neutral', count: NEUTRAL_COUNT, rating: 3, comments: NEUTRAL_COMMENTS },
      { type: 'negative', count: NEGATIVE_COUNT, rating: 1, comments: NEGATIVE_COMMENTS },
    ];

    let responseIndex = 0;
    
    // Responses with comments
    for (const group of sentimentBreakdown) {
      for (let i = 0; i < group.count; i++) {
        const attendee = attendees[responseIndex++];
        const responseEntry = {
          respondentName: attendee.name,
          respondentEmail: attendee.email,
          submittedAt: eventDate,
          responses: []
        };

        // Answers
        form.questions.forEach(q => {
          let answer;
          if (q.type === 'scale') {
            answer = group.rating;
          } else {
            answer = getRandomElement(group.comments);
          }
          responseEntry.responses.push({
            questionId: q._id.toString(),
            questionTitle: q.title,
            answer,
            sectionId: "main"
          });
        });
        responses.push(responseEntry);
      }
    }

    // Remaining responses without comments
    const remainingCount = RESPONSE_COUNT - responses.length;
    for (let i = 0; i < remainingCount; i++) {
      const attendee = attendees[responseIndex++];
      const responseEntry = {
        respondentName: attendee.name,
        respondentEmail: attendee.email,
        submittedAt: eventDate,
        responses: []
      };

      form.questions.forEach(q => {
        let answer;
        if (q.type === 'scale') {
          answer = Math.floor(Math.random() * 3) + 3; // 3 to 5
        } else {
          answer = ""; // No comment
        }
        responseEntry.responses.push({
          questionId: q._id.toString(),
          questionTitle: q.title,
          answer,
          sectionId: "main"
        });
      });
      responses.push(responseEntry);
    }

    // Save Form
    form.attendeeList = attendees;
    form.responses = responses;
    form.responseCount = responses.length;
    await form.save();

    console.log(`✅ Seeded ${TITLE}`);
    console.log(`   - Attendees: ${TOTAL_ATTENDEES}`);
    console.log(`   - Responses: ${RESPONSE_COUNT}`);
    console.log(`   - Comments: ${POSITIVE_COUNT} Pos, ${NEUTRAL_COUNT} Neu, ${NEGATIVE_COUNT} Neg`);

    /* 
    // Trigger Analytics Computation (Optional: can be slow depending on Python env)
    console.log("Computing analytics...");
    await AnalyticsCacheService.computeAndCacheAnalytics(form._id);
    console.log("✅ Analytics computed and cached.");
    */
    console.log("Note: Analytics will be computed on the first view of the report.");

    process.exit(0);
  } catch (err) {
    console.error("Error seeding form:", err);
    process.exit(1);
  }
};

seedData();
