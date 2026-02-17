const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../utils/db");
const Form = require("../models/Form");
const User = require("../models/User");
const Report = require("../models/Report");
const AnalyticsCacheService = require("../services/analysis/analyticsCacheService");

// Configuration
const TITLES = [
    "Intramurals 2026",
    "Intramurals 2025",
    "Higher Education 2025",
    "Higher Education 2026"
];

const TARGET_EMAIL = "rodolfojrebajan@student.laverdad.edu.ph";

// --- UPDATED COMMENT ARRAYS (English, Tagalog, Taglish) ---

const POSITIVE_COMMENTS = [
  // English
  "Excellent event! Very well organized and informative.",
  "I learned so much from the speakers. Great job to the organizers!",
  "The venue was perfect and the sessions were very engaging.",
  "Best event I've attended this year. Highly recommend!",
  
  // Tagalog
  "Napakaganda ng event! Marami akong natutunan at nakita.",
  "Ang saya ng mga activities, lalo na yung sa hapon.",
  "Sulit ang pagod namin dito. Sana maulit muli.",
  "Maayos ang daloy ng programa at magagaling ang mga nagsalita.",

  // Taglish
  "Super enjoy! The vibe was immaculate.",
  "Solid ng experience na 'to. The networking was super helpful.",
  "Ang galing ng speakers, very relatable yung topics.",
  "Sobrang organized, walang dull moments. Kudos sa team!",
  "Nice one! Nakakagana mag-participate kapag ganito ang event."
];

const NEUTRAL_COMMENTS = [
  // English
  "The event was okay. Some sessions were better than others.",
  "Good overall, but the venue could be improved.",
  "Decent event. The registration process was a bit slow.",
  "Average experience. Expected more interactive sessions.",

  // Tagalog
  "Pwede na rin. Medyo mainit lang sa venue.",
  "Sakto lang. Mas maganda yung event last year.",
  "Okay naman pero sana mas maiksi ang oras.",
  "Hindi masyadong malinaw ang audio sa likod.",

  // Taglish
  "Goods naman, pero medyo boring yung opening remarks.",
  "It was fine, kaso ang tagal mag-start kaya nakakaantok.",
  "Medyo magulo yung pila, but the content was okay.",
  "Not bad, pero sana may free food next time haha.",
  "Okay yung speakers, pero yung technical setup medyo sablay."
];

const NEGATIVE_COMMENTS = [
  // English
  "Very disappointed. The event was poorly organized.",
  "The speakers were unprepared and the content was outdated.",
  "Waste of time. Expected much more from this event.",
  "The sound system was terrible, I couldn't hear anything.",

  // Tagalog
  "Kakila-kilabot ang karanasan. Hindi organized ang event.",
  "Sayang lang sa oras. Walang kwenta yung mga topic.",
  "Ang gulo ng sistema. Walang nakakaalam kung ano ang gagawin.",
  "Sobrang init at siksikan. Hindi inisip ang kapakanan ng students.",

  // Taglish
  "Super delay ang start! Nakaka-drain maghintay.",
  "Not worth it. Ang gulo ng instructions sa registration.",
  "The venue is too small for us, sobrang init.",
  "Walang coordination yung organizers. Very chaotic.",
  "Sana nag-prepare kayo ng maayos. Very disappointing."
];

// --- END OF UPDATED COMMENTS ---

const DEPARTMENTS = ["Higher Education", "Basic Education"];
const HE_YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const BE_YEARS = ["Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];
const PROGRAMS = {
  "Higher Education": ["BSIS", "ACT", "BSA", "BSBA", "BSSW"],
  "Basic Education": ["STEM", "HUMSS", "GAS", "ICT"]
};

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const generateEmail = (prefix, index) => `${prefix}${index}@test.com`;

const buildResponse = (form, attendee, rating, comment, date) => {
    const entry = {
        respondentName: attendee.name,
        respondentEmail: attendee.email,
        submittedAt: date,
        responses: []
    };
    form.questions.forEach(q => {
        entry.responses.push({
            questionId: q._id.toString(),
            questionTitle: q.title,
            answer: q.type === 'scale' ? rating : comment,
            sectionId: "main"
        });
    });
    return entry;
};

const createFormAndData = async (creator, title, isHEOnly, totalAtt, respLimit, pCount, nCount, negCount) => {
    const year = title.includes("2026") ? 2026 : 2025;
    const eventDate = new Date(year, 1, 15);

    const questions = [];
    for (let i = 1; i <= 6; i++) {
        questions.push({
            _id: new mongoose.Types.ObjectId(),
            title: `Rate the event quality (Q${i})`,
            type: "scale",
            low: 1, high: 5, required: true, sectionId: "main"
        });
    }
    questions.push({
        _id: new mongoose.Types.ObjectId(),
        title: "Comments/Suggestions",
        type: "paragraph",
        required: false, sectionId: "main"
    });

    const form = new Form({
        title,
        description: `Evaluation for ${title}`,
        status: "published",
        type: "evaluation",
        createdBy: creator._id,
        publishedAt: eventDate,
        eventStartDate: eventDate,
        eventEndDate: eventDate,
        questions: questions
    });

    const attendees = [];
    for (let i = 0; i < totalAtt; i++) {
        const dept = isHEOnly ? "Higher Education" : getRandomElement(DEPARTMENTS);
        const prog = getRandomElement(PROGRAMS[dept]);
        const yLevel = dept === "Higher Education" ? getRandomElement(HE_YEARS) : getRandomElement(BE_YEARS);
        
        attendees.push({
            name: `${dept} Student ${i + 1}`,
            email: generateEmail(title.replace(/\s+/g, '').toLowerCase(), i),
            department: dept,
            program: prog,
            yearLevel: yLevel,
            hasResponded: i < respLimit
        });
    }

    const responses = [];
    let rIdx = 0;
    for (let i = 0; i < pCount && rIdx < respLimit; i++) responses.push(buildResponse(form, attendees[rIdx++], 5, getRandomElement(POSITIVE_COMMENTS), eventDate));
    for (let i = 0; i < nCount && rIdx < respLimit; i++) responses.push(buildResponse(form, attendees[rIdx++], 3, getRandomElement(NEUTRAL_COMMENTS), eventDate));
    for (let i = 0; i < negCount && rIdx < respLimit; i++) responses.push(buildResponse(form, attendees[rIdx++], 1, getRandomElement(NEGATIVE_COMMENTS), eventDate));
    while (rIdx < respLimit) responses.push(buildResponse(form, attendees[rIdx++], 4, "", eventDate));

    form.attendeeList = attendees;
    form.responses = responses;
    form.responseCount = responses.length;
    await form.save();

    const report = new Report({
        formId: form._id, userId: creator._id, title: form.title,
        eventDate: form.eventStartDate, status: "published", isGenerated: true,
        feedbackCount: form.responseCount,
        metadata: {
            description: form.description,
            attendeeCount: form.attendeeList.length,
            responseRate: (form.responseCount / form.attendeeList.length * 100).toFixed(1)
        }
    });
    await report.save();

    console.log(`- Computing analytics for: ${title}...`);
    try {
        const analytics = await AnalyticsCacheService.computeAndCacheAnalytics(form._id);
        
        // Update report with snapshot data
        const report = await Report.findOne({ formId: form._id, userId: creator._id });
        if (report) {
            report.dataSnapshot = {
                responses: form.responses,
                analytics: {
                    quantitativeData: {
                        totalResponses: analytics.totalResponses,
                        totalAttendees: analytics.totalAttendees,
                        responseRate: analytics.responseRate,
                        averageRating: analytics.averageRating || 0,
                    },
                    sentimentBreakdown: analytics.sentimentBreakdown,
                    categorizedComments: analytics.categorizedComments,
                    questionBreakdown: analytics.questionBreakdown,
                    charts: analytics.responseOverview
                },
                metadata: {
                    title: form.title,
                    description: form.description,
                    attendeeCount: form.attendeeList.length,
                    responseRate: (form.responseCount / form.attendeeList.length * 100).toFixed(1),
                    eventStartDate: form.eventStartDate,
                    eventEndDate: form.eventEndDate,
                },
                snapshotDate: new Date()
            };
            await report.save();
            console.log(`  ✓ Analytics computed and snapshot created.`);
        }
    } catch (err) {
        console.log(`  x Failed: ${err.message}`);
    }
};

const seed = async () => {
    try {
        await connectDB();
        await Form.deleteMany({ title: { $in: TITLES } });
        await Report.deleteMany({ title: { $in: TITLES } });

        let creator = await User.findOne({ email: TARGET_EMAIL }) || await User.findOne({ role: "psas" });
        if (!creator) creator = await User.create({ name: "Rodolfo", email: TARGET_EMAIL, role: "psas", googleId: "rod_seed" });

        console.log("Seeding Intramurals...");
        await createFormAndData(creator, "Intramurals 2026", false, 500, 237, 29, 11, 3);
        await createFormAndData(creator, "Intramurals 2025", true, 200, 100, 80, 15, 5);

        console.log("Seeding Higher Education Comparison...");
        await createFormAndData(creator, "Higher Education 2026", true, 250, 150, 120, 20, 10);
        await createFormAndData(creator, "Higher Education 2025", true, 250, 130, 100, 20, 10);

        console.log("✅ All seeding complete!");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seed();