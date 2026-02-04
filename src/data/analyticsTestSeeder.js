const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../utils/db");
const Form = require("../models/Form");
const User = require("../models/User");

/**
 * Helper: expands base comments into EXACTLY 50 unique comments
 */
const expandTo50 = (baseComments) => {
  const result = [];
  let i = 1;

  while (result.length < 50) {
    for (const comment of baseComments) {
      if (result.length >= 50) break;
      result.push(`${comment} #${i}`);
      i++;
    }
  }
  return result;
};

/**
 * COMMENTS
 */
const POSITIVE_COMMENTS = expandTo50([
  // English
  "The event exceeded all my expectations",
  "The speakers were engaging and knowledgeable",
  "Everything was well organized",
  "The workshop was very practical",
  "I learned a lot from the sessions",

  // Tagalog
  "Napakaganda ng pagkaka-organisa ng event",
  "Mahusay ang mga speakers at malinaw ang paliwanag",
  "Sulit ang oras sa pagdalo",
  "Maraming bagong kaalaman ang natutunan ko",
  "Maayos at propesyonal ang buong programa",

  // Taglish
  "Super ganda ng event, very informative",
  "Ang galing ng speakers, hindi boring",
  "Smooth lang yung flow ng program",
  "Worth it yung attendance, daming learnings",
  "Okay na okay yung overall experience"
]);

const NEGATIVE_COMMENTS = expandTo50([
  // English
  "The event was poorly organized",
  "The speakers were unprepared",
  "There were too many technical issues",
  "The session started very late",
  "The content was disappointing",

  // Tagalog
  "Magulo ang sistema ng event",
  "Hindi maayos ang oras ng programa",
  "Nakakadismaya ang kabuuang karanasan",
  "Sayang ang oras at pagod",
  "Hindi malinaw ang mga paliwanag",

  // Taglish
  "Magulo yung flow ng event",
  "Late nagsimula kaya nakakainis",
  "Hindi worth it yung pinunta ko",
  "Ang daming technical problems",
  "Disappointed ako sa overall experience"
]);

const NEUTRAL_COMMENTS = expandTo50([
  // English
  "The event was okay",
  "It was a normal seminar",
  "Some parts were interesting, others were not",
  "The content was average",
  "Nothing really stood out",

  // Tagalog
  "Sakto lang ang event",
  "Maayos naman pero may pwede pang ayusin",
  "Okay lang ang naging programa",
  "Walang masyadong special",
  "Katamtaman lang ang karanasan",

  // Taglish
  "Okay lang naman yung event",
  "Normal lang, nothing special",
  "May okay parts, may boring din",
  "Pwede na pero may improvements pa",
  "Hindi siya bad, hindi rin great"
]);

const seedAnalyticsData = async () => {
  try {
    await connectDB();
    console.log("Connected to database...");

    const admin = await User.findOne({ role: { $in: ["psas", "mis"] } });
    if (!admin) {
      console.error("No PSAS or MIS user found. Run base seeder first.");
      process.exit(1);
    }

    const qId1 = new mongoose.Types.ObjectId().toString();
    const qId2 = new mongoose.Types.ObjectId().toString();
    const qId3 = new mongoose.Types.ObjectId().toString();

    const form = new Form({
      title: "Balanced Analytics Test Form " + new Date().toLocaleDateString(),
      description: "Seeded form for scale ratings and sentiment analysis",
      status: "published",
      createdBy: admin._id,
      questions: [
        {
          _id: qId1,
          title: "Overall Satisfaction (1-5)",
          type: "scale",
          icon: "star",
          sectionId: "main"
        },
        {
          _id: qId2,
          title: "Service Delivery Rating (1-10 Likert)",
          type: "scale",
          icon: "heart",
          sectionId: "main"
        },
        {
          _id: qId3,
          title: "Please provide your comments and suggestions",
          type: "paragraph",
          sectionId: "main"
        }
      ],
      attendeeList: [
        {
          name: "Sample Attendee",
          email: "sample@example.com",
          department: "Higher Education",
          yearLevel: "1"
        }
      ],
      eventStartDate: new Date(),
      eventEndDate: new Date()
    });

    const responses = [];

    for (let i = 0; i < 150; i++) {
      let comment, rating5, rating10;

      if (i < 50) {
        comment = POSITIVE_COMMENTS[i];
        rating5 = 4 + (i % 2);      // 4–5
        rating10 = 8 + (i % 3);     // 8–10
      } else if (i < 100) {
        comment = NEGATIVE_COMMENTS[i - 50];
        rating5 = 1 + (i % 2);      // 1–2
        rating10 = 1 + (i % 4);     // 1–4
      } else {
        comment = NEUTRAL_COMMENTS[i - 100];
        rating5 = 3;               // neutral
        rating10 = 5 + (i % 3);     // 5–7
      }

      responses.push({
        respondentEmail: `tester${i}@example.com`,
        respondentName: `Tester ${i}`,
        submittedAt: new Date(Date.now() - i * 600000),
        responses: [
          {
            questionId: qId1,
            questionTitle: "Overall Satisfaction (1-5)",
            answer: rating5.toString()
          },
          {
            questionId: qId2,
            questionTitle: "Service Delivery Rating (1-10 Likert)",
            answer: rating10.toString()
          },
          {
            questionId: qId3,
            questionTitle: "Please provide your comments and suggestions",
            answer: comment
          }
        ]
      });
    }

    form.responses = responses;
    form.responseCount = responses.length;
    await form.save();

    console.log("====================================");
    console.log("SUCCESS: Analytics Test Data Seeded");
    console.log("Positive:", 50);
    console.log("Negative:", 50);
    console.log("Neutral :", 50);
    console.log("Total   :", 150);
    console.log("====================================");

    process.exit(0);
  } catch (err) {
    console.error("Seeder error:", err);
    process.exit(1);
  }
};

seedAnalyticsData();
