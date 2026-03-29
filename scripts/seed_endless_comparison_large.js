require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const connectDB = require("../src/utils/db");
const Form = require("../src/models/Form");
const User = require("../src/models/User");
const Feedback = require("../src/models/Feedback");
const Event = require("../src/models/Event");
const Report = require("../src/models/Report");

// Configuration
const BASE_TITLE = "Endless";
const DEPARTMENTS = ["Higher Education", "Basic Education", "IT Department", "Business Dept", "Nursing", "Engineering", "Arts & Sciences", "Education"];
const PROGRAMS = ["BSCS", "BSIS", "ACT", "BSA", "BSN", "BSECE", "Grade 12", "Grade 11", "Grade 10", "Grade 9", "AB English", "BEED"];

// --- Comment Generators ---
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
    
    // Shuffle
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

const randomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const getWeightedRating = (weight) => {
  const rand = Math.random();
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
    console.log(`Connected to MongoDB for large comparison seeding... Title: ${BASE_TITLE}`);

    const targetEmail = "rodolfojrebajan@student.laverdad.edu.ph";
    let creator = await User.findOne({ email: targetEmail });
    if (!creator) {
        creator = await User.findOne({ role: "psas" }) || await User.findOne();
    }
    if (!creator) {
      console.error("No user found to create forms.");
      process.exit(1);
    }
    console.log(`Using user: ${creator.email}`);

    // --- 1. Create 2025 Event ---
    console.log(`Creating ${BASE_TITLE} 2025...`);
    const form2025 = await createEventForm(
      creator._id,
      `${BASE_TITLE} 2025`,
      new Date("2025-06-15"),
      new Date("2025-06-16")
    );
    await populateEventData(form2025, {
      count: 1000, 
      sentimentBias: 'positive',
      departments: DEPARTMENTS,
      programs: PROGRAMS
    });

    // --- 2. Create 2026 Event ---
    console.log(`Creating ${BASE_TITLE} 2026...`);
    const form2026 = await createEventForm(
      creator._id,
      `${BASE_TITLE} 2026`,
      new Date("2026-06-15"),
      new Date("2026-06-16")
    );
    await populateEventData(form2026, {
        count: 1000,
        sentimentBias: 'mixed', 
        departments: DEPARTMENTS,
        programs: PROGRAMS
    });

    console.log("\n=================================");
    console.log("SEEDING COMPLETE");
    console.log("=================================");
    console.log(`2025 Form ID: ${form2025._id}`);
    console.log(`2026 Form ID: ${form2026._id}`);
    console.log("=================================");
    console.log("How to test analysis speed & comparison:");
    console.log("1. Open the UI and go to 'Event Analytics'.");
    console.log(`2. Find '${BASE_TITLE} 2026'.`);
    console.log("3. Click 'Generate Report'.");
    console.log("4. The system will analyze 1000 responses for 2026 and link them to 2025 for comparison.");
    console.log("=================================");

    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
};

async function createEventForm(userId, title, startDate, endDate) {
    const newForm = new Form({
        title: title,
        description: `Large scale ${title} evaluation for performance testing.`,
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
                high: 10,
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
    }

    const posComments = COMMENTS.positive;
    const neuComments = COMMENTS.neutral;
    const negComments = COMMENTS.negative;

    for (let i = 0; i < config.count; i++) {
        const dept = getRandom(config.departments);
        const prog = getRandom(config.programs);
        const email = `student${i}_${form.title.replace(/\s+/g, '_')}_${Math.floor(Math.random()*10000)}@test.com`;
        
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
        } else {
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

        feedbackDocs.push({
            eventId: eventDoc._id, 
            userId: new mongoose.Types.ObjectId(),
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
}

seed();
