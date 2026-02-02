const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../utils/db");
const Form = require("../models/Form");
const User = require("../models/User");
const Report = require("../models/Report");
const thumbnailService = require("../services/thumbnail/thumbnailService");


// Configuration
const CURRENT_EVENT_TITLE = "Foundation Day 2026";
const PREVIOUS_EVENT_TITLE = "Foundation Day 2025";
const TARGET_EMAIL = "rodolfojrebajan@student.laverdad.edu.ph";

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
    title: "Feedback and Suggestions",
    type: "paragraph",
    required: false,
    sectionId: "main",
  }
];

const comments = {
  positive: [
    "Great event! Looking forward to the next one!",
    "Everything was perfect and well organized.",
    "The speakers were amazing. Job well done!",
    "Had a blast, definitely coming back next year!",
  ],
  neutral: [
    "It was okay, but some parts were long.",
    "Decent event, looking forward to improvements.",
    "Normal experience, nothing too special.",
  ],
  negative: [
    "Too crowded and hot.",
    "The audio was terrible, I couldn't hear the speaker.",
    "Medyo magulo ang pila.",
  ]
};

const higherEdLevels = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const basicEdLevels = ["7", "8", "9", "10", "11", "12"]; // Will be normalized to Grade X

const generateResponses = (form, year) => {
  const responses = [];
  const attendeeList = [];
  
  // 1. Generate Higher Ed Attendees (20 per year)
  higherEdLevels.forEach((level, idx) => {
    const count = 5 + idx; // Just some variation
    for (let i = 0; i < count; i++) {
      const email = `college${year}${level.replace(" ", "")}${i}@example.com`;
      attendeeList.push({
        name: `College ${level} Student ${i}`,
        email,
        department: "Higher Education",
        yearLevel: level,
        hasResponded: true
      });

      const isPositive = Math.random() > 0.2;
      const rating = isPositive ? 5 : 2;
      const commentPool = isPositive ? comments.positive : comments.negative;
      const comment = commentPool[Math.floor(Math.random() * commentPool.length)];

      responses.push({
        responses: [
          {
            questionId: form.questions[0]._id.toString(),
            questionTitle: form.questions[0].title,
            answer: rating,
            sectionId: "main",
          },
          {
            questionId: form.questions[1]._id.toString(),
            questionTitle: form.questions[1].title,
            answer: comment,
            sectionId: "main",
          }
        ],
        respondentEmail: email,
        respondentName: `Student ${i}`,
        submittedAt: new Date(year, 1, 15)
      });
    }
  });

  // 2. Generate Basic Ed Attendees (10 per grade)
  basicEdLevels.forEach((level, idx) => {
    const count = 3 + idx;
    for (let i = 0; i < count; i++) {
      const email = `basic${year}${level}${i}@example.com`;
      attendeeList.push({
        name: `Basic Ed Grade ${level} Student ${i}`,
        email,
        department: "Basic Education",
        yearLevel: level,
        hasResponded: true
      });

      const isPositive = Math.random() > 0.3;
      const rating = isPositive ? 4 : 3;
      const commentPool = isPositive ? comments.positive : comments.neutral;
      const comment = commentPool[Math.floor(Math.random() * commentPool.length)];

      responses.push({
        responses: [
          {
            questionId: form.questions[0]._id.toString(),
            questionTitle: form.questions[0].title,
            answer: rating,
            sectionId: "main",
          },
          {
            questionId: form.questions[1]._id.toString(),
            questionTitle: form.questions[1].title,
            answer: comment,
            sectionId: "main",
          }
        ],
        respondentEmail: email,
        respondentName: `Student ${i}`,
        submittedAt: new Date(year, 1, 15)
      });
    }
  });

  return { responses, attendeeList };
};

const seedCombinedData = async () => {
  try {
    await connectDB();
    console.log("Connected to DB");

    let creator = await User.findOne({ email: TARGET_EMAIL });
    if (!creator) creator = await User.findOne({ role: "psas" });
    
    // Explicitly delete all matching forms and reports first for this title set
    await Form.deleteMany({ title: { $in: [CURRENT_EVENT_TITLE, PREVIOUS_EVENT_TITLE] } });
    await Report.deleteMany({ title: { $in: [CURRENT_EVENT_TITLE, PREVIOUS_EVENT_TITLE] } });

    // Previous Year
    const prevForm = new Form({
      title: PREVIOUS_EVENT_TITLE,
      status: "published",
      type: "evaluation",
      createdBy: creator._id,
      questions: [
        { ...sampleQuestions[0], _id: new mongoose.Types.ObjectId() },
        { ...sampleQuestions[1], _id: new mongoose.Types.ObjectId() }
      ],
      eventStartDate: new Date(2025, 0, 1),
      createdAt: new Date(2025, 0, 1),
      publishedAt: new Date(2025, 0, 1),
    });
    const prevData = generateResponses(prevForm, 2025);
    prevForm.responses = prevData.responses;
    prevForm.attendeeList = prevData.attendeeList;
    prevForm.responseCount = prevData.responses.length;
    await prevForm.save();
    console.log(`Created: ${PREVIOUS_EVENT_TITLE}`);

    // Current Year
    const currForm = new Form({
      title: CURRENT_EVENT_TITLE,
      status: "published",
      type: "evaluation",
      createdBy: creator._id,
      questions: [
        { ...sampleQuestions[0], _id: new mongoose.Types.ObjectId() },
        { ...sampleQuestions[1], _id: new mongoose.Types.ObjectId() }
      ],
      eventStartDate: new Date(2026, 0, 1),
      createdAt: new Date(2026, 0, 1),
      publishedAt: new Date(2026, 0, 1),
    });
    const currData = generateResponses(currForm, 2026);
    currForm.responses = currData.responses;
    currForm.attendeeList = currData.attendeeList;
    currForm.responseCount = currData.responses.length;
    await currForm.save();
    console.log(`Created: ${CURRENT_EVENT_TITLE}`);

    // Create Report entries
    console.log("Generating Report entries...");
    for (const f of [prevForm, currForm]) {
      // Generate actual thumbnail file
      const thumbnailPath = await thumbnailService.generateReportThumbnail(f._id, f.title, true);

      const report = new Report({
        formId: f._id,
        userId: creator._id,
        title: f.title,
        eventDate: f.eventStartDate || f.createdAt,
        status: f.status,
        isGenerated: true,
        feedbackCount: f.responses.length,
        averageRating: 4.5,
        thumbnail: thumbnailPath,
        metadata: {
          description: f.description,
          attendeeCount: f.attendeeList.length,
          responseRate: 100
        }
      });
      await report.save();
      console.log(`- Report generated for: ${f.title} (${report.eventDate.getFullYear()})`);
    }

    console.log("\n✅ Combined Seeding Complete!");
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seedCombinedData();
