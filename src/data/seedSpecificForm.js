const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../utils/db");
const Form = require("../models/Form");
const User = require("../models/User");

// --- Configuration ---
const EVENTS_TO_SEED = [
  {
    title: `Seeded Evaluation Form ${new Date().getFullYear()}`,
    yearOffset: 0,
    responseCount: 150,
    sentimentTarget: { positive: 50, neutral: 50, negative: 50 },
  },
  {
    title: `Seeded Evaluation Form ${new Date().getFullYear() - 1}`,
    yearOffset: -1,
    responseCount: 100,
    sentimentTarget: { positive: 30, neutral: 40, negative: 30 },
  },
];

// --- Constants ---
const DEPARTMENTS = ["Basic Education", "Higher Education"];
const PROGRAMS = {
  "Basic Education": ["STEM", "GAS", "ICT", "HUMSS"],
  "Higher Education": ["BSIS", "ACT", "BSA", "BSAIS", "BAB", "BSSW"],
};
const YEAR_LEVELS = {
  "Basic Education": [
    "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6",
    "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"
  ],
  "Higher Education": ["1st Year", "2nd Year", "3rd Year", "4th Year"],
};

const POSITIVE_COMMENTS = [
  "Excellent event! Very well organized and informative.",
  "I learned so much from the speakers. Great job to the organizers!",
  "The venue was perfect and the sessions were very engaging.",
  "Best event I've attended this year. Highly recommend!",
  "Amazing experience! The networking opportunities were invaluable.",
  "Very professional setup. The topics were relevant and timely.",
  "Loved every moment of it. Can't wait for the next one!",
  "The speakers were knowledgeable and the content was top-notch.",
  "Well-structured program with excellent time management.",
  "Outstanding organization and great learning experience.",
];

const NEUTRAL_COMMENTS = [
  "The event was okay. Some sessions were better than others.",
  "Good overall, but the venue could be improved.",
  "Decent event. The registration process was a bit slow.",
  "Average experience. Expected more interactive sessions.",
  "The content was relevant but the timing could be better.",
  "Some speakers were great, others were just okay.",
  "Not bad, but I've been to better events before.",
  "The event met my expectations, nothing more, nothing less.",
  "Okay naman ang event. Medyo mahaba lang ang waiting time.",
  "The sessions were informative but a bit too long.",
];

const NEGATIVE_COMMENTS = [
  "Very disappointed. The event was poorly organized.",
  "The speakers were unprepared and the content was outdated.",
  "Waste of time. Expected much more from this event.",
  "Too crowded and the air conditioning was not working properly.",
  "The event started late and many sessions were cancelled.",
  "Poor audio quality made it hard to hear the speakers.",
  "The food was terrible and the service was slow.",
  "Not worth the registration fee. Very disappointing.",
  "Kakila-kilabot ang karanasan. Hindi organized ang event.",
  "The venue was too small for the number of attendees.",
];

// --- Helpers ---
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

const generateEmail = (name) => {
  const nameParts = name.toLowerCase().split(" ");
  const domain = "student.lvcc.edu.ph";
  const randomNum = Math.floor(Math.random() * 1000);
  return `${nameParts[0]}.${nameParts[1]}${randomNum}@${domain}`;
};

const generateParticipant = () => {
  const firstNames = ["Juan", "Maria", "Jose", "Ana", "Pedro", "Rosa", "Carlos", "Elena", "Miguel", "Sofia"];
  const lastNames = ["Cruz", "Santos", "Reyes", "Garcia", "Gonzales", "Martinez", "Lopez", "Rodriguez", "Hernandez", "Ramirez"];
  const name = `${getRandomElement(firstNames)} ${getRandomElement(lastNames)}_${Math.floor(Math.random()*1000)}`;
  
  const dept = getRandomElement(DEPARTMENTS);
  const program = getRandomElement(PROGRAMS[dept]);
  const year = getRandomElement(YEAR_LEVELS[dept]);
  
  return {
    name,
    email: generateEmail(name),
    department: dept,
    program,
    yearLevel: year,
    hasResponded: true,
  };
};

// --- Main Seed Function ---
const seedForms = async () => {
  try {
    await connectDB();
    console.log("Connected to MongoDB.");

    // Find an admin/creator
    let creator = await User.findOne({ role: "psas" });
    if (!creator) {
      creator = await User.findOne({ role: "admin" });
    }
    if (!creator) {
      console.log("Creating temp admin user...");
      creator = await User.create({
        name: "Seed Admin",
        email: "seed.admin@test.com",
        role: "psas",
        googleId: "seed_admin_123"
      });
    }

    const questionStructure = [
      {
        title: "Was the event good?",
        type: "scale",
        required: true,
        options: [],
        low: 1,
        high: 5,
        sectionId: "main"
      },
      {
        title: "Rate your experience.",
        type: "scale",
        required: true,
        options: [],
        low: 1,
        high: 5,
        sectionId: "main"
      },
      {
        title: "How was your experience?",
        type: "paragraph", // Using paragraph for sentiment analysis
        required: true,
        options: [],
        sectionId: "main"
      },
      {
        title: "Is This good?",
        type: "scale",
        required: true,
        options: [],
        low: 1,
        high: 5,
        sectionId: "main"
      },
      {
        title: "whats your name?", // Intentionally matching the vague questions user had before
        type: "scale",
        required: true,
        options: [],
        low: 1,
        high: 5,
        sectionId: "main"
      },
      {
        title: "How old are you?",
        type: "scale",
        required: true,
        options: [],
        low: 1,
        high: 10,
        sectionId: "main"
      },
      {
        title: "What was your overall experience?",
        type: "multiple_choice",
        required: true,
        options: ["Positive", "Neutral", "Negative"],
        sectionId: "main"
      }
    ];

    for (const eventConfig of EVENTS_TO_SEED) {
      console.log(`\nCreating form: ${eventConfig.title}`);
      
      const eventDate = new Date();
      eventDate.setFullYear(eventDate.getFullYear() + eventConfig.yearOffset);

      // Create Form
      const form = new Form({
        title: eventConfig.title,
        description: `Seeded form for ${eventDate.getFullYear()} comparison testing.`,
        status: "published",
        type: "evaluation",
        createdBy: creator._id,
        publishedAt: eventDate,
        eventStartDate: eventDate,
        eventEndDate: eventDate,
        questions: questionStructure, // Mongoose will generate _ids
        attendeeList: [],
        responses: []
      });

      // Save first to get question IDs
      await form.save();

      // Generate Responses
      const responses = [];
      const attendees = [];
      
      const targets = [
        { type: 'positive', count: eventConfig.sentimentTarget.positive, rating: 5, comments: POSITIVE_COMMENTS },
        { type: 'neutral', count: eventConfig.sentimentTarget.neutral, rating: 3, comments: NEUTRAL_COMMENTS },
        { type: 'negative', count: eventConfig.sentimentTarget.negative, rating: 1, comments: NEGATIVE_COMMENTS },
      ];

      for (const target of targets) {
        for (let i = 0; i < target.count; i++) {
          const participant = generateParticipant();
          attendees.push(participant);
          
          const responseEntry = {
            respondentName: participant.name,
            respondentEmail: participant.email,
            submittedAt: eventDate,
            responses: []
          };

          // Answer each question
          for (const q of form.questions) {
            let answer;
            if (q.type === 'scale') {
              if (q.high === 10) answer = target.rating * 2; // adjust for 1-10
              else answer = target.rating;
            } else if (q.type === 'paragraph' || q.type === 'short_answer') {
              answer = getRandomElement(target.comments);
            } else if (q.type === 'multiple_choice') {
              answer = target.type.charAt(0).toUpperCase() + target.type.slice(1);
            }

            responseEntry.responses.push({
              questionId: q._id.toString(),
              questionTitle: q.title,
              answer: answer,
              sectionId: "main"
            });
          }
          responses.push(responseEntry);
        }
      }

      // Shuffle responses to mix submission order (optional, but good for realism)
      // (Simple shuffle)
      responses.sort(() => Math.random() - 0.5);

      form.attendeeList = attendees;
      form.responses = responses;
      form.responseCount = responses.length;

      await form.save();
      console.log(`✅ Created ${eventConfig.title} with ${responses.length} responses.`);
    }

    console.log("\n✅ Seeding Complete!");
    process.exit(0);

  } catch (err) {
    console.error("Error seeding forms:", err);
    process.exit(1);
  }
};

seedForms();
