const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../utils/db");
const Form = require("../models/Form");
const User = require("../models/User");
const Report = require("../models/Report");

// Configuration
const CURRENT_EVENT_TITLE = "Higher Education 2026";
const PREVIOUS_EVENT_TITLE = "Higher Education 2025";
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

const positiveComments = [
  "Great event! Looking forward to the next one!",
  "Excellent experience, well organized.",
  "Looking forward to next year!",
  "Highly informative, great job.",
  "Best Higher Ed event so far!"
];

const yearLevels = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

const generateResponses = (form, count, year) => {
  const responses = [];
  const attendeeList = [];
  
  // Distribute responses across year levels
  for (let i = 0; i < count; i++) {
    const yearLevel = yearLevels[i % yearLevels.length];
    const email = `student${year}${i}@example.com`;
    const name = `Student ${year} ${i}`;
    
    // Add to attendee list
    attendeeList.push({
      name,
      email,
      department: "Higher Education",
      yearLevel: yearLevel,
      hasResponded: true
    });

    const isPositive = Math.random() > 0.2; // 80% positive
    const rating = isPositive ? 5 : 3;
    const comment = isPositive
      ? positiveComments[Math.floor(Math.random() * positiveComments.length)]
      : "Okay lang naman, but can be improved.";

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
      respondentName: name,
      submittedAt: new Date(year, 1, 15) // Feb 15 of that year
    });
  }
  return { responses, attendeeList };
};

const seedHigherEdData = async () => {
  try {
    await connectDB();
    console.log("Connected to DB");

    // 1. Find creator
    let creator = await User.findOne({ email: TARGET_EMAIL });
    if (!creator) {
      console.log(`User ${TARGET_EMAIL} not found, falling back to any PSAS.`);
      creator = await User.findOne({ role: "psas" });
    }
    
    if (!creator) {
      console.error("No PSAS user found. Please seed users first.");
      process.exit(1);
    }
    console.log(`Using creator: ${creator.email}`);

    // 2. Cleanup
    await Form.deleteMany({
      title: { $in: [CURRENT_EVENT_TITLE, PREVIOUS_EVENT_TITLE] },
    });
    await Report.deleteMany({
      title: { $in: [CURRENT_EVENT_TITLE, PREVIOUS_EVENT_TITLE] },
    });
    console.log("Cleaned up existing Higher Ed forms and reports.");

    // 3. Create Previous Year
    const prevDate = new Date(2025, 1, 10);
    const prevForm = new Form({
      title: PREVIOUS_EVENT_TITLE,
      description: "Annual Event for Higher Ed 2025",
      status: "published",
      type: "evaluation",
      createdBy: creator._id,
      questions: [
        { ...sampleQuestions[0], _id: new mongoose.Types.ObjectId() },
        { ...sampleQuestions[1], _id: new mongoose.Types.ObjectId() }
      ],
      eventStartDate: prevDate,
      createdAt: prevDate,
      publishedAt: prevDate,
    });

    const prevData = generateResponses(prevForm, 40, 2025);
    prevForm.responses = prevData.responses;
    prevForm.attendeeList = prevData.attendeeList;
    prevForm.responseCount = prevData.responses.length;
    await prevForm.save();
    console.log(`Created: ${PREVIOUS_EVENT_TITLE} (40 responses)`);

    // 4. Create Current Year
    const currDate = new Date(2026, 1, 10);
    const currForm = new Form({
      title: CURRENT_EVENT_TITLE,
      description: "Annual Event for Higher Ed 2026",
      status: "published",
      type: "evaluation",
      createdBy: creator._id,
      questions: [
        { ...sampleQuestions[0], _id: new mongoose.Types.ObjectId() },
        { ...sampleQuestions[1], _id: new mongoose.Types.ObjectId() }
      ],
      eventStartDate: currDate,
      createdAt: currDate,
      publishedAt: currDate,
    });

    const currData = generateResponses(currForm, 20, 2026);
    currForm.responses = currData.responses;
    currForm.attendeeList = currData.attendeeList;
    currForm.responseCount = currData.responses.length;
    await currForm.save();
    console.log(`Created: ${CURRENT_EVENT_TITLE} (20 responses)`);

    // 5. Create Report entries
    console.log("Generating Report entries...");
    for (const f of [prevForm, currForm]) {
      const report = new Report({
        formId: f._id,
        userId: creator._id,
        title: f.title,
        eventDate: f.eventStartDate || f.createdAt,
        status: f.status,
        isGenerated: true,
        feedbackCount: f.responses.length,
        averageRating: 4.8,
        metadata: {
          description: f.description,
          attendeeCount: f.attendeeList.length,
          responseRate: 100
        }
      });
      await report.save();
      console.log(`- Report generated for: ${f.title} (${report.eventDate.getFullYear()})`);
    }

    console.log("\n✅ Seeding Higher Ed Comparison Complete!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
};

seedHigherEdData();
