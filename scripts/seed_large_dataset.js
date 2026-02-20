require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const connectDB = require("../src/utils/db");
const Form = require("../src/models/Form");
const User = require("../src/models/User");
const Feedback = require("../src/models/Feedback");
const Event = require("../src/models/Event");

// Configuration
const BASE_TITLE = "Grand University Summit";
const DEPARTMENTS = ["Higher Education", "Basic Education", "IT Department", "Business Dept", "Nursing", "Engineering", "Arts & Sciences", "Education"];
const PROGRAMS = ["BSCS", "BSIS", "ACT", "BSA", "BSN", "BSECE", "Grade 12", "Grade 11", "Grade 10", "Grade 9", "AB English", "BEED"];

// --- Comment Generators ---
// We need 100 unique comments for each sentiment.
// Strategy: Mix and match sentence parts.
// 5 Subjects * 5 Verbs * 4 Adjectives = 100 combinations per sentiment is easy.

// --- Comment Generators ---
// We need 100 unique comments for each sentiment.
// Strategy: Mix and match sentence parts for English, Tagalog, and Taglish.

const ENGLISH_PARTS = {
  positive: {
    subjects: ["The event", "The session", "The speaker", "The organization", "The overall experience"],
    verbs: ["was", "seemed", "felt", "appeared", "proved to be"],
    adjectives: ["excellent", "outstanding", "inspiring", "very informative", "highly engaging"],
    closers: ["and I learned a lot.", "and well worth my time.", "and I would recommend it.", "and exceeded expectations.", "."]
  },
  neutral: {
    subjects: ["The event", "The program", "The flow", "The venue", "The presentation"],
    verbs: ["was", "felt", "seemed", "appeared", "was mostly"],
    adjectives: ["okay", "average", "acceptable", "standard", "fine"],
    closers: ["but nothing special.", "but could use improvement.", "though a bit long.", "but met basic expectations.", "."]
  },
  negative: {
    subjects: ["The event", "The session", "The speaker", "The management", "The experience"],
    verbs: ["was", "seemed", "felt", "became", "was unfortunately"],
    adjectives: ["disappointing", "boring", "disorganized", "unengaging", "below average"],
    closers: ["and a waste of time.", "and I expected more.", "and needs major fixing.", "and quite frustrating.", "."]
  }
};

const TAGALOG_PARTS = {
  positive: {
    subjects: ["Ang event", "Ang seminar", "Ang speaker", "Ang programa", "Ang experience ko"],
    verbs: ["ay", "ay naging", "ay talagang", "ay sobrang", "ay tunay na"],
    adjectives: ["maganda", "maayos", "masaya", "nakaka-inspire", "sulit"],
    closers: ["at marami akong natutunan.", "at uulit ako.", "at nakakatuwa.", "at ang galing ng lahat.", "."]
  },
  neutral: {
    subjects: ["Ang event", "Yung seminar", "Ang daloy", "Yung venue", "Ang presentation"],
    verbs: ["ay", "ay medyo", "ay parang", "ay saktong", "ay"],
    adjectives: ["okay lang", "pwede na", "sakto lang", "karaniwan", "hindi masyadong special"],
    closers: ["pero may kulang.", "pero okay naman.", "kaso medyo matagal.", "pero oks lang.", "."]
  },
  negative: {
    subjects: ["Ang event", "Yung session", "Ang speaker", "Ang sistema", "Ang buong experience"],
    verbs: ["ay", "ay naging", "ay parang", "ay sobrang", "ay nakaka-"],
    adjectives: ["pangit", "gulo", "boring", "walang kwenta", "bitin sa quality"],
    closers: ["at sayang sa oras.", "at nakakadismaya.", "at ang gulo gulo.", "at hindi ako natuwa.", "."]
  }
};

const TAGLISH_PARTS = {
  positive: {
    subjects: ["The event", "Ang speaker", "Yung flow", "The whole program", "My experience"],
    verbs: ["was so", "ay sobrang", "is really", "ay naging", "was very"],
    adjectives: ["ganda", "solid", "engaging", "ayos", "impressive"],
    closers: ["and I learned a lot.", "at super sulit.", "nakaka-enjoy talaga.", "and worth it.", "."]
  },
  neutral: {
    subjects: ["The event", "Yung program", "The venue", "Ang presentation", "Expectations ko"],
    verbs: ["was just", "ay medyo", "seemed", "ay parang", "was a bit"],
    adjectives: ["okay lang", "average", "sakto lang", "boring ng konti", "basic"],
    closers: ["but could be better.", "pero pwede na.", "kaso ang init.", "but nothing special.", "."]
  },
  negative: {
    subjects: ["The event", "Ang speaker", "Yung system", "The management", "Attendance"],
    verbs: ["was", "ay sobrang", "is kind of", "ay nakaka-", "was really"],
    adjectives: ["labo", "bad trip", "disorganized", "hassle", "walang kwenta"],
    closers: ["sobrang sayang sa oras.", "very disappointing.", "nakaka-stress.", "didn't learn anything.", "."]
  }
};

const generateComments = (sentimentType) => {
    const comments = [];
    
    // Helper to build comments from parts
    const build = (parts) => {
        parts.subjects.forEach(sub => {
            parts.verbs.forEach(v => {
                parts.adjectives.forEach(adj => {
                     parts.closers.forEach(close => {
                         comments.push(`${sub} ${v} ${adj} ${close}`);
                     });
                });
            });
        });
    };

    build(ENGLISH_PARTS[sentimentType]);
    build(TAGALOG_PARTS[sentimentType]);
    build(TAGLISH_PARTS[sentimentType]);

    // Shuffle the comments to ensure mix
    for (let i = comments.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [comments[i], comments[j]] = [comments[j], comments[i]];
    }

    return [...new Set(comments)]; 
};

const COMMENTS = {
    positive: generateComments('positive'),
    neutral: generateComments('neutral'),
    negative: generateComments('negative')
};

// Helper to generate random date
const randomDate = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

// Helper to get random item from array
const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Helper to get weighted random rating (1-10)
const getWeightedRating = (weight) => {
  const rand = Math.random();
  // High: 8-10
  // Mixed: 4-7
  // Low: 1-3
  if (weight === 'high') {
    return rand < 0.7 ? getRandom([10, 9, 9, 8]) : getRandom([7, 8]);
  } else if (weight === 'low') {
    return rand < 0.7 ? getRandom([1, 2, 2, 3]) : getRandom([3, 4]);
  } else {
    return getRandom([4, 5, 6, 7]);
  }
};

const seed = async () => {
  try {
    await connectDB();
    console.log("Connected to MongoDB for large dataset seeding...");

    // Find the specific creator or fallback
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
    console.log(`Creating forms as user: ${creator.email} (${creator._id})`);

    // --- 1. Create Previous Year Event (2024) - Benchmark ---
    console.log("Creating 2024 Event (Benchmark)...");
    const form2024 = await createEventForm(
      creator._id,
      `${BASE_TITLE} 2024`,
      new Date("2024-05-15"),
      new Date("2024-05-16")
    );
    
    await populateEventData(form2024, {
      count: 2000, 
      sentimentBias: 'positive',
      departments: DEPARTMENTS, // Mix all
      programs: PROGRAMS
    });

    // --- 2. Create Current Year Event (2025) - Comparison ---
    console.log("Creating 2025 Event (Comparison)...");
    const form2025 = await createEventForm(
      creator._id,
      `${BASE_TITLE} 2025`,
      new Date("2025-05-15"),
      new Date("2025-05-16")
    );

    await populateEventData(form2025, {
        count: 2000,
        sentimentBias: 'mixed', // varied results
        departments: DEPARTMENTS,
        programs: PROGRAMS
    });

    console.log("\n=================================");
    console.log("SEEDING COMPLETE");
    console.log("=================================");
    console.log(`Type: LARGE DATASET (2000 responses/event)`);
    console.log(`Event 2024 ID: ${form2024._id}`);
    console.log(`Event 2025 ID: ${form2025._id}`);
    console.log("=================================");

    process.exit(0);

  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
};

async function createEventForm(userId, title, startDate, endDate) {
    // Create Form with rating scale 1-10
    const newForm = new Form({
        title: title,
        description: "Large scale annual evaluation for student satisfaction.",
        createdBy: userId,
        status: "published",
        eventStartDate: startDate,
        eventEndDate: endDate,
        publishedAt: new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000), 
        createdAt: new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000), 
        updatedAt: new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000),
        questions: [
            {
                questionId: "q1",
                title: "How satisfied were you with the event?",
                type: "scale",
                low: 1,
                high: 10,  // Scale of 10
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
    return await newForm.save({ timestamps: false });
}

async function populateEventData(form, config) {
    const attendees = [];
    const dbResponses = [];
    const feedbackDocs = [];
    
    // Create shadow Event document for Feedback linkage
    let eventDoc = await Event.findOne({ name: form.title, date: form.eventStartDate });
    if (!eventDoc) {
        eventDoc = new Event({
            name: form.title,
            date: form.eventStartDate,
            endDate: form.eventEndDate,
            description: form.description,
            createdAt: form.createdAt,
        });
        await eventDoc.save({ timestamps: false });
        console.log(`Created shadow Event document: ${eventDoc._id}`);
    } else {
        console.log(`Using existing Event document: ${eventDoc._id}`);
    }

    // Generate logic
    console.log(`Generating ${config.count} responses...`);
    
    // To handle 2000 iterations without blocking, we can do it in one go (memory should be fine for 2000 objects),
    // but we can optimize if `generateComments` is expensive. It is not.
    
    // We already have COMMENTS pre-generated.
    const posComments = COMMENTS.positive;
    const neuComments = COMMENTS.neutral;
    const negComments = COMMENTS.negative;

    for (let i = 0; i < config.count; i++) {
        const dept = getRandom(config.departments);
        const prog = getRandom(config.programs);
        const email = `student${i}_${Date.now()}_${Math.floor(Math.random()*1000)}@test.com`;
        
        attendees.push({
            name: `Student ${i}`,
            email: email,
            Department: dept,
            Program: prog,
            uploadedAt: new Date(),
            hasResponded: true 
        });

        let sentiment;
        let ratingWeight;
        let commentPool;
        
        if (config.sentimentBias === 'positive') {
             const r = Math.random();
             if (r < 0.7) { sentiment = 'positive'; ratingWeight = 'high'; commentPool = posComments; }
             else if (r < 0.9) { sentiment = 'neutral'; ratingWeight = 'mixed'; commentPool = neuComments; }
             else { sentiment = 'negative'; ratingWeight = 'low'; commentPool = negComments; }
        } else { // mixed
             const r = Math.random();
             if (r < 0.4) { sentiment = 'positive'; ratingWeight = 'high'; commentPool = posComments; }
             else if (r < 0.7) { sentiment = 'neutral'; ratingWeight = 'mixed'; commentPool = neuComments; }
             else { sentiment = 'negative'; ratingWeight = 'low'; commentPool = negComments; }
        }

        const rating = getWeightedRating(ratingWeight);
        const comment = getRandom(commentPool);

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

        const fakeUserId = new mongoose.Types.ObjectId(); 
        feedbackDocs.push({
            eventId: eventDoc._id, 
            userId: fakeUserId,
            rating: rating,
            comment: comment,
            createdAt: randomDate(form.eventStartDate, form.eventEndDate)
        });
    }

    form.attendeeList = attendees;
    form.responses = dbResponses;
    form.responseCount = dbResponses.length;
    await form.save();

    await Feedback.insertMany(feedbackDocs);
    console.log(`Saved ${config.count} responses and feedbacks for ${form.title}.`);
}

seed();
