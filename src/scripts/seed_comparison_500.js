console.log("🚀 Starting seeder script...");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../utils/db");

// Models
const Form = require("../models/Form");
const User = require("../models/User");

// Target user
const TARGET_EMAIL = "rodolfojrebajan@student.laverdad.edu.ph";

// Comments - English, Tagalog, and Taglish for each sentiment
const comments = {
  positive: [
    "Excellent event! Very well organized and informative.",
    "Napakaganda ng event! Marami akong natutunan.",
    "Very informative talaga ang event. Ang speakers ay amazing!",
    "I learned so much from the speakers. Great job!",
    "Sobrang informative ng mga sessions. Salamat sa opportunity!",
    "Napaka-organize ng program at sobrang productive ang sessions.",
    "Loved every moment of it. Can't wait for the next one!",
    "Magandang karanasan! Ang mga speaker ay tunay na eksperto.",
    "Ang venue is beautiful at kumportable. Maganda ang experience!",
    "The speakers were knowledgeable and top-notch content.",
    "Highly recommended seminar for all students here.",
    "The workshops were very hands-on and practical.",
    "Great atmosphere and very welcoming organizers.",
    "Best event I've attended this semester so far!",
    "Fantastic speakers and very relevant topics discussed.",
    "I really enjoyed the networking opportunities provided.",
    "The materials provided were very helpful for my studies.",
    "Impressive coordination and very smooth transitions.",
    "The Q&A session was very enlightening and helpful.",
    "Exceptional quality of presentations and materials."
  ],
  neutral: [
    "The event was okay. Some sessions were better than others.",
    "Okay lang ang event. Medyo mahaba ang waiting time.",
    "Okay lang ang event. Some parts were really good, iba hindi.",
    "Good overall, but the venue could be improved.",
    "Ang program ay maganda pero may mga kulang pa.",
    "Ang venue ay maganda but crowded kasi maraming attendees.",
    "Satisfactory event. Could use more hands-on activities.",
    "Natutunan ko ang ilang things, pero hindi lahat relevant.",
    "The speakers ay knowledgeable but ang delivery ay monotone.",
    "Average experience. Expected more interactive sessions.",
    "It was an alright session, nothing too special though.",
    "Some topics were redundant but overall it was fine.",
    "The pacing was a bit slow in the middle part.",
    "Decent content but the air conditioning was too cold.",
    "The registration process took a bit longer than expected.",
    "I have mixed feelings about some of the presentations.",
    "It met my expectations but didn't necessarily exceed them.",
    "Standard seminar format, could be more innovative.",
    "The food was okay, nothing to write home about.",
    "The speakers were competent but lacked some energy."
  ],
  negative: [
    "Very disappointed. The event was poorly organized.",
    "Kakila-kilabot ang karanasan. Hindi organized ang event.",
    "Hindi ako satisfied sa event. Poorly organized talaga.",
    "Waste of time. Expected much more from this event.",
    "Sayang ang oras at pera sa event na ito talaga.",
    "Ang content ay outdated. Parang old material lang.",
    "Poor audio quality made it hard to hear the speakers.",
    "Ang audio ay napakasama. Hindi namin marinig ang speakers.",
    "Ang audio quality ay napakagulo. Hindi maintindihan.",
    "The food was terrible and the service was slow.",
    "I regret coming here, it was a complete mess.",
    "The speakers seemed unprepared and disorganized.",
    "Total waste of resources and effort for everyone.",
    "Worst event organization I have ever experienced.",
    "The schedule was not followed at all, very confusing.",
    "None of the topics were relevant to my course.",
    "The venue was too small and very uncomfortable.",
    "Technical issues ruined most of the presentations.",
    "The staff were quite rude and not helpful at all.",
    "I wouldn't recommend this to any other students."
  ]
};

const generateRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const seedComparisonData = async () => {
  try {
    await connectDB();
    console.log("Connected to Database!");

    // Find creator
    let creator = await User.findOne({ email: TARGET_EMAIL });
    if (!creator) {
      console.log(`User ${TARGET_EMAIL} not found. Creating user...`);
      creator = new User({
        name: "Rodolfo Rebajan",
        email: TARGET_EMAIL,
        password: "Password@123",
        role: "psas",
        isActive: true
      });
      await creator.save();
    }
    console.log(`Using creator: ${creator.email} (${creator._id})`);

    const forms = [
      {
        title: "Annual Student Development Seminar 2026",
        year: 2026,
        startDate: new Date("2026-01-15T08:00:00"),
        endDate: new Date("2026-01-15T17:00:00"),
      },
      {
        title: "Annual Student Development Seminar 2025",
        year: 2025,
        startDate: new Date("2025-01-15T08:00:00"),
        endDate: new Date("2025-01-15T17:00:00"),
      }
    ];

    for (const formData of forms) {
      console.log(`\nCreating form: ${formData.title}`);
      
      // Delete existing if any
      await Form.deleteOne({ title: formData.title });

      const form = new Form({
        title: formData.title,
        description: `Annual evaluation event for ${formData.year}.`,
        type: "evaluation",
        status: "published",
        createdBy: creator._id,
        eventStartDate: formData.startDate,
        eventEndDate: formData.endDate,
        createdAt: formData.startDate,
        publishedAt: formData.startDate,
        questions: [
          {
            title: "Overall Rating",
            type: "scale",
            required: true,
            low: 1,
            high: 5,
            lowLabel: "Poor",
            highLabel: "Excellent",
            sectionId: "main"
          },
          {
            title: "Comments and Suggestions",
            type: "paragraph",
            required: true,
            sectionId: "main"
          }
        ]
      });

      // Save to get IDs
      await form.save();
      const ratingQid = form.questions[0]._id.toString();
      const commentQid = form.questions[1]._id.toString();

      console.log(`Generating 500 responses for ${formData.year}...`);
      const responses = [];
      const attendeeList = [];

      // Distribution: ~166 positive, ~167 neutral, ~167 negative = 500
      const counts = { positive: 166, neutral: 167, negative: 167 };
      let count = 0;

      for (const sentiment of ['positive', 'neutral', 'negative']) {
        for (let i = 0; i < counts[sentiment]; i++) {
          count++;
          const firstName = `Student${count}`;
          const lastName = `${formData.year}`;
          const email = `student${count}.${formData.year}@example.com`;
          
          let rating;
          if (sentiment === 'positive') rating = generateRandomInt(4, 5);
          else if (sentiment === 'neutral') rating = 3;
          else rating = generateRandomInt(1, 2);

          const commentList = comments[sentiment];
          const comment = commentList[generateRandomInt(0, commentList.length - 1)];

          attendeeList.push({
            name: `${firstName} ${lastName}`,
            email,
            department: count % 2 === 0 ? "Higher Education" : "Basic Education",
            yearLevel: count % 2 === 0 ? "3rd Year" : "Grade 10",
            hasResponded: true
          });

          responses.push({
            responses: [
              {
                questionId: ratingQid,
                questionTitle: "Overall Rating",
                answer: rating,
                sectionId: "main"
              },
              {
                questionId: commentQid,
                questionTitle: "Comments and Suggestions",
                answer: comment,
                sectionId: "main"
              }
            ],
            respondentEmail: email,
            respondentName: `${firstName} ${lastName}`,
            submittedAt: new Date(formData.startDate.getTime() + generateRandomInt(0, 8 * 60 * 60 * 1000))
          });
        }
      }

      // Shuffle both lists together to avoid ordered blocks
      const combined = responses.map((r, i) => ({ response: r, attendee: attendeeList[i] }));
      for (let i = combined.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [combined[i], combined[j]] = [combined[j], combined[i]];
      }

      form.responses = combined.map(c => c.response);
      form.attendeeList = combined.map(c => c.attendee);
      form.responseCount = responses.length;
      await form.save();
      
      console.log(`✅ ${formData.title} seeded with ${responses.length} responses.`);
    }

    console.log("\n✨ Seeding process completed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

seedComparisonData();
