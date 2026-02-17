const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const connectDB = require("../utils/db");

const Form = require("../models/Form");
const User = require("../models/User");

// ---------- Helpers ----------

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

const basicYearLevels = [
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
];

const higherYearLevels = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

// Short, clearly polarized comments so the analyzers classify them correctly
const positiveComments = [
  "The event was excellent and very well organized.",
  "Great speakers and a very informative program.",
  "I really enjoyed the sessions, everything was great.",
  "Amazing experience, I learned a lot.",
  "Very good program, I am happy with the event.",
];

const neutralComments = [
  "The event was okay and generally fine.",
  "It was an average experience, nothing special.",
  "The program was acceptable, neither good nor bad.",
  "Overall the event was fine and ordinary.",
  "The sessions were alright and moderate.",
];

const negativeComments = [
  "The event was bad and poorly organized.",
  "Very disappointing experience, I did not like it.",
  "The program was terrible and a waste of time.",
  "I am unhappy with the event, it was awful.",
  "The sessions were boring and frustrating.",
];

// Generate a simple fake name/email based on index & department
const makePerson = (index, department, yearLevel) => {
  const prefix = department === "Basic Education" ? "basic" : "higher";
  const name = `${prefix.toUpperCase()} Student ${index + 1}`;
  const email = `${prefix}.student${index + 1}@example.com`;
  return { name, email, yearLevel, department };
};

// Create questions for the synthetic form
const buildQuestions = () => {
  const scaleId = new mongoose.Types.ObjectId();
  const likeId = new mongoose.Types.ObjectId();
  const improveId = new mongoose.Types.ObjectId();

  return {
    scaleQuestion: {
      _id: scaleId,
      title: "Overall Rating",
      type: "scale",
      required: true,
      low: 1,
      high: 10,
      lowLabel: "Very Poor",
      highLabel: "Excellent",
      sectionId: "main",
    },
    likeQuestion: {
      _id: likeId,
      title: "What did you like about the event?",
      type: "paragraph",
      required: false,
      sectionId: "main",
    },
    improveQuestion: {
      _id: improveId,
      title: "What can be improved in the event?",
      type: "paragraph",
      required: false,
      sectionId: "main",
    },
  };
};

// Build a single response document for a given person & sentiment label
const buildResponse = (questions, person, sentimentLabel, submittedAt) => {
  let rating;
  let likeComment;
  let improveComment;

  // Force very clear rating distribution for each sentiment bucket
  if (sentimentLabel === "positive") {
    rating = 9; // clearly positive
    likeComment = randomItem(positiveComments);
    improveComment = "Nothing significant to improve.";
  } else if (sentimentLabel === "negative") {
    rating = 2; // clearly negative
    likeComment = "Very few things to like in this event.";
    improveComment = randomItem(negativeComments);
  } else {
    rating = 5; // neutral middle rating
    likeComment = randomItem(neutralComments);
    improveComment = "Some parts were fine, some need improvement.";
  }

  return {
    responses: [
      {
        questionId: questions.scaleQuestion._id.toString(),
        questionTitle: questions.scaleQuestion.title,
        answer: rating,
        sectionId: questions.scaleQuestion.sectionId,
      },
      {
        questionId: questions.likeQuestion._id.toString(),
        questionTitle: questions.likeQuestion.title,
        answer: likeComment,
        sectionId: questions.likeQuestion.sectionId,
      },
      {
        questionId: questions.improveQuestion._id.toString(),
        questionTitle: questions.improveQuestion.title,
        answer: improveComment,
        sectionId: questions.improveQuestion.sectionId,
      },
    ],
    respondentEmail: person.email.toLowerCase(),
    respondentName: person.name,
    submittedAt,
  };
};

// ---------- Main seeding logic ----------

const seedLargeFormResponses = async () => {
  await connectDB();

  try {
    // Use the requested user as the form owner (creator)
    const targetEmail = "rodolfojrebajan@student.laverdad.edu.ph";

    let creator = await User.findOne({ email: targetEmail });

    if (!creator) {
      console.log(
        `No user found with email ${targetEmail}. Creating one as PSAS so it can own reports.`,
      );
      creator = await User.create({
        name: "Rodolfo J. Rebajan",
        email: targetEmail,
        role: "psas",
        isActive: true,
      });
    } else {
      console.log(
        `Using existing user ${creator.email} (role: ${creator.role}) as form creator.`,
      );
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const previousYear = currentYear - 1;

    const baseTitle = "Large Analytics Load Test Event";
    const currentTitle = `${baseTitle} ${currentYear}`;
    const previousTitle = `${baseTitle} ${previousYear}`;

    console.log(
      `Seeding large test forms:\n- Current year: ${currentTitle}\n- Previous year: ${previousTitle}`,
    );

    // Clean up any existing forms with the same titles to avoid duplicates
    await Form.deleteMany({ title: { $in: [currentTitle, previousTitle] } });

    const questions = buildQuestions();

    // ----- Create current-year form -----
    const currentForm = new Form({
      title: currentTitle,
      description:
        "Synthetic form for load-testing analytics (current year dataset).",
      createdBy: creator._id,
      status: "published",
      type: "evaluation",
      eventStartDate: new Date(currentYear, 0, 15),
      eventEndDate: new Date(currentYear, 0, 15),
      questions: [questions.scaleQuestion, questions.likeQuestion, questions.improveQuestion],
      attendeeList: [],
      responses: [],
    });

    // ----- Create previous-year form -----
    const previousForm = new Form({
      title: previousTitle,
      description:
        "Synthetic form for load-testing analytics (previous year comparison dataset).",
      createdBy: creator._id,
      status: "published",
      type: "evaluation",
      eventStartDate: new Date(previousYear, 0, 15),
      eventEndDate: new Date(previousYear, 0, 15),
      questions: [questions.scaleQuestion, questions.likeQuestion, questions.improveQuestion],
      attendeeList: [],
      responses: [],
    });

    await currentForm.save();
    await previousForm.save();

    // Ensure createdAt years differ so findPreviousYearForm can link them
    await Form.updateOne(
      { _id: currentForm._id },
      { $set: { createdAt: new Date(currentYear, 0, 20) } },
    );
    await Form.updateOne(
      { _id: previousForm._id },
      { $set: { createdAt: new Date(previousYear, 0, 20) } },
    );

    console.log(
      `Created forms:\n- Current: ${currentForm._id}\n- Previous: ${previousForm._id}`,
    );

    // ---------- Build responses for CURRENT year ----------
    const currentTotalResponses = 1000; // total responses (Basic + Higher)
    const targetPerSentiment = 100; // at least 100 positive, 100 neutral, 100 negative

    const currentResponses = [];
    const currentAttendees = [];

    // First, guarantee 100 of each sentiment
    const sentimentOrder = [
      ...Array(targetPerSentiment).fill("positive"),
      ...Array(targetPerSentiment).fill("neutral"),
      ...Array(targetPerSentiment).fill("negative"),
    ];

    // Remaining responses will have random sentiments
    const remaining = currentTotalResponses - sentimentOrder.length;
    const sentimentPool = ["positive", "neutral", "negative"];
    for (let i = 0; i < remaining; i++) {
      sentimentOrder.push(randomItem(sentimentPool));
    }

    // Mix Basic Education and Higher Education students across all responses
    for (let i = 0; i < currentTotalResponses; i++) {
      const department =
        i % 2 === 0 ? "Basic Education" : "Higher Education"; // simple alternating mix
      const yearLevel =
        department === "Basic Education"
          ? randomItem(basicYearLevels)
          : randomItem(higherYearLevels);

      const person = makePerson(i, department, yearLevel);

      currentAttendees.push({
        userId: null,
        name: person.name,
        email: person.email.toLowerCase(),
        yearLevel: person.yearLevel,
        department: person.department,
        program:
          department === "Higher Education"
            ? "BS Information Technology"
            : "Junior High School",
        hasResponded: true,
      });

      const daysAgo = Math.floor(Math.random() * 30);
      const submittedAt = new Date(
        currentYear,
        0,
        20 - daysAgo,
        10,
        Math.floor(Math.random() * 60),
      );

      const sentimentLabel = sentimentOrder[i];
      currentResponses.push(
        buildResponse(questions, person, sentimentLabel, submittedAt),
      );
    }

    currentForm.attendeeList = currentAttendees;
    currentForm.responses = currentResponses;
    currentForm.responseCount = currentResponses.length;
    await currentForm.save();

    console.log(
      `Current year form seeded with ${currentForm.responseCount} responses (mixed Basic & Higher, >= ${targetPerSentiment} of each sentiment).`,
    );

    // ---------- Build responses for PREVIOUS year (more than current) ----------
    const previousTotalResponses = 1500; // more than current for comparison
    const previousResponses = [];
    const previousAttendees = [];

    const prevSentimentOrder = [];
    // Ensure at least the same baseline of 100 each for the previous year too
    prevSentimentOrder.push(
      ...Array(targetPerSentiment).fill("positive"),
      ...Array(targetPerSentiment).fill("neutral"),
      ...Array(targetPerSentiment).fill("negative"),
    );
    const prevRemaining = previousTotalResponses - prevSentimentOrder.length;
    for (let i = 0; i < prevRemaining; i++) {
      prevSentimentOrder.push(randomItem(sentimentPool));
    }

    for (let i = 0; i < previousTotalResponses; i++) {
      const department =
        i % 2 === 0 ? "Basic Education" : "Higher Education";
      const yearLevel =
        department === "Basic Education"
          ? randomItem(basicYearLevels)
          : randomItem(higherYearLevels);

      const person = makePerson(i, department, yearLevel);

      previousAttendees.push({
        userId: null,
        name: person.name,
        email: person.email.toLowerCase(),
        yearLevel: person.yearLevel,
        department: person.department,
        program:
          department === "Higher Education"
            ? "BS Information Technology"
            : "Junior High School",
        hasResponded: true,
      });

      const daysAgo = Math.floor(Math.random() * 30);
      const submittedAt = new Date(
        previousYear,
        0,
        20 - daysAgo,
        10,
        Math.floor(Math.random() * 60),
      );

      const sentimentLabel = prevSentimentOrder[i];
      previousResponses.push(
        buildResponse(questions, person, sentimentLabel, submittedAt),
      );
    }

    previousForm.attendeeList = previousAttendees;
    previousForm.responses = previousResponses;
    previousForm.responseCount = previousResponses.length;
    await previousForm.save();

    console.log(
      `Previous year form seeded with ${previousForm.responseCount} responses (more than current year, mixed Basic & Higher, >= ${targetPerSentiment} of each sentiment).`,
    );

    console.log("\n✅ Large load-test datasets created successfully.");
    console.log(
      `Current form ID: ${currentForm._id}\nPrevious form ID: ${previousForm._id}`,
    );
    console.log(
      "You can now open analytics for the current-year form; the system should automatically detect the previous-year form for comparison.",
    );

    process.exit(0);
  } catch (err) {
    console.error("Error seeding large form responses:", err);
    process.exit(1);
  }
};

seedLargeFormResponses();

