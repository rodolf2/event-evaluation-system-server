const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../utils/db");
const Form = require("../models/Form");
const User = require("../models/User");

// Configuration
const CURRENT_EVENT_TITLE = "10th ICT Week Celebration 2026";
const PREVIOUS_EVENT_TITLE = "9th ICT Week Celebration 2025";
const TARGET_EMAIL = "rodolfojrebajan@student.laverdad.edu.ph"; // User's email

const sampleQuestions = [
  {
    title: "How would you rate the event?",
    type: "scale",
    required: true,
    low: 1,
    high: 5,
    lowLabel: "Poor",
    highLabel: "Excellent",
    sectionId: "main",
  },
  {
    title: "What did you like most?",
    type: "paragraph",
    required: false,
    sectionId: "main",
  },
  {
    title: "What can be improved?",
    type: "paragraph",
    required: false,
    sectionId: "main",
  },
];

const positiveComments = [
  "Great event! Learned a lot.",
  "The speakers were amazing.",
  "Well organized and fun.",
  "Excellent venue and food.",
  "Looking forward to the next one!",
];

const negativeComments = [
  "The venue was too hot.",
  "Audio quality was poor.",
  "Started late, very disorganized.",
  "Sessions were boring.",
  "Not enough food for everyone.",
];

const generateResponses = (count, isPreviousYear) => {
  const responses = [];
  const baseDate = isPreviousYear
    ? new Date(new Date().setFullYear(new Date().getFullYear() - 1))
    : new Date();

  for (let i = 0; i < count; i++) {
    const isPositive = Math.random() > 0.3; // 70% positive
    const rating = isPositive ? 5 : 2;
    const comment = isPositive
      ? positiveComments[Math.floor(Math.random() * positiveComments.length)]
      : negativeComments[Math.floor(Math.random() * negativeComments.length)];

    const responseSet = [
      {
        questionId: "q1", // Will be replaced with real ID
        questionTitle: "How would you rate the event?",
        answer: rating,
        sectionId: "main",
      },
      {
        questionId: "q2",
        questionTitle: "What did you like most?",
        answer: isPositive ? comment : "N/A",
        sectionId: "main",
      },
      {
        questionId: "q3", // Will match negative comment question
        questionTitle: "What can be improved?",
        answer: isPositive ? "Nothing" : comment,
        sectionId: "main",
      },
    ];

    responses.push({
      responses: responseSet,
      respondentEmail: `user${i}@example.com`,
      respondentName: `User ${i}`,
      submittedAt: baseDate,
    });
  }
  return responses;
};

const seedComparisonData = async () => {
  try {
    await connectDB();
    console.log("Connected to DB");

    // 1. Find a creator (User)
    let creator = await User.findOne({ email: TARGET_EMAIL });
    if (!creator) {
      console.log(`User ${TARGET_EMAIL} not found, falling back to any PSAS user.`);
      creator = await User.findOne({ role: "psas" });
    }
    
    if (!creator) {
      console.error("No PSAS user found. Please seed users first.");
      process.exit(1);
    }
    console.log(`Using creator: ${creator.email}`);

    // 2. Clean up existing forms with these names to avoid duplicates
    await Form.deleteMany({
      title: { $in: [CURRENT_EVENT_TITLE, PREVIOUS_EVENT_TITLE] },
    });
    console.log("Cleaned up existing forms.");

    // 3. Create Previous Year Form
    const prevDate = new Date();
    prevDate.setFullYear(prevDate.getFullYear() - 1); // 1 year ago

    const prevForm = new Form({
      title: PREVIOUS_EVENT_TITLE,
      description: "Evaluation for last year's ICT Week",
      status: "published",
      type: "evaluation",
      createdBy: creator._id,
      questions: sampleQuestions,
      createdAt: prevDate,
      publishedAt: prevDate,
    });

    // Generate real IDs for questions
    prevForm.questions[0]._id = new mongoose.Types.ObjectId();
    prevForm.questions[1]._id = new mongoose.Types.ObjectId();
    prevForm.questions[2]._id = new mongoose.Types.ObjectId();

    // Add responses
    const prevResponses = generateResponses(50, true);
    // Fix question IDs in responses
    prevResponses.forEach((r) => {
      r.responses[0].questionId = prevForm.questions[0]._id.toString();
      r.responses[0].questionTitle = prevForm.questions[0].title;
      r.responses[1].questionId = prevForm.questions[1]._id.toString();
      r.responses[1].questionTitle = prevForm.questions[1].title;
      r.responses[2].questionId = prevForm.questions[2]._id.toString();
      r.responses[2].questionTitle = prevForm.questions[2].title;
    });
    prevForm.responses = prevResponses;
    prevForm.responseCount = prevResponses.length;

    await prevForm.save();
    console.log(`Created Previous Form: "${prevForm.title}" with ${prevForm.responseCount} responses.`);

    // 4. Create Current Year Form
    const currDate = new Date(); // Now

    const currForm = new Form({
      title: CURRENT_EVENT_TITLE,
      description: "Evaluation for this year's ICT Week",
      status: "published",
      type: "evaluation",
      createdBy: creator._id,
      questions: sampleQuestions,
      createdAt: currDate,
      publishedAt: currDate,
    });

    // Generate real IDs
    currForm.questions[0]._id = new mongoose.Types.ObjectId();
    currForm.questions[1]._id = new mongoose.Types.ObjectId();
    currForm.questions[2]._id = new mongoose.Types.ObjectId();

    // Add responses
    const currResponses = generateResponses(20, false);
    // Fix question IDs
    currResponses.forEach((r) => {
      r.responses[0].questionId = currForm.questions[0]._id.toString();
      r.responses[0].questionTitle = currForm.questions[0].title;
      r.responses[1].questionId = currForm.questions[1]._id.toString();
      r.responses[1].questionTitle = currForm.questions[1].title;
      r.responses[2].questionId = currForm.questions[2]._id.toString();
      r.responses[2].questionTitle = currForm.questions[2].title;
    });
    currForm.responses = currResponses;
    currForm.responseCount = currResponses.length;

    await currForm.save();
    console.log(`Created Current Form: "${currForm.title}" with ${currForm.responseCount} responses.`);

    console.log("\n✅ Seeding Complete!");
    console.log("You can now verify the Previous Year Comparison logic.");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
};

seedComparisonData();
