const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../utils/db");
const Event = require("../models/Event");
const Form = require("../models/Form");
const User = require("../models/User");

// --- Data Arrays ---

const departments = [
  "College of Computer Studies",
  "College of Engineering",
  "College of Education",
  "College of Arts and Sciences",
  "Senior High School",
  "Junior High School",
];

const programs = [
  "BS Computer Science",
  "BS Information Systems",
  "BS Civil Engineering",
  "BS Secondary Education",
  "AB Broadcasting",
];

const firstNames = [
  "Juan", "Maria", "Jose", "Ana", "Pedro", "Rosa", "Carlos", "Elena", "Miguel", "Sofia",
  "Antonio", "Isabella", "Fernando", "Camila", "Ricardo", "Valentina", "Eduardo", "Gabriela", "Luis", "Patricia",
  "Angelo", "Kristine", "Mark", "Jenny", "Paolo", "Bea", "Rico", "Diana", "Gino", "Carla"
];

const lastNames = [
  "Dela Cruz", "Santos", "Reyes", "Garcia", "Gonzales", "Martinez", "Lopez", "Rodriguez", "Hernandez", "Ramirez",
  "Flores", "Torres", "Morales", "Diaz", "Castillo", "Romero", "Jimenez", "Vargas", "Mendoza", "Navarro",
  "Aquino", "Bautista", "Ocampo", "Villanueva", "Castro", "Rivera", "Mercado", "Salazar", "Delos Santos", "Pineda"
];

// --- Verified Tagalog/Taglish/English Comments ---

const positiveComments = [
  // English
  "The event was incredibly well-organized and informative.",
  "I learned a lot from the speakers. Great job!",
  "Excellent venue and very engaging sessions.",
  "One of the best events I've attended this year.",
  "The topics were very relevant to my course.",
  "Great food and amazing networking opportunities.",
  "I really enjoyed the workshop segment.",
  "The speakers were very knowledgeable and approachable.",
  "Everything started on time, which I really appreciated.",
  "Looking forward to the next event like this.",
  // Tagalog
  "Ang ganda ng program, sobrang daming natutunan.",
  "Mahusay ang mga speakers, malinaw magpaliwanag.",
  "Masarap ang pagkain at maayos ang venue.",
  "Sana maulit muli ang ganitong seminar.",
  "Napakalaking tulong nito sa pag-aaral namin.",
  "Ang saya ng event, hindi boring.",
  "Maayos ang flow ng program mula simula hanggang wakas.",
  "Nakaka-inspire ang mga kwento ng speakers.",
  "Sulit ang oras na inilaan ko dito.",
  "Maganda ang pag-aaasikaso ng organizers.",
  // Taglish
  "Super enjoy yung activities, very interactive.",
  "Ang galing ng speakers, very relatable ang topics.",
  "Solid ng event na 'to, sana may part 2.",
  "Very organized, walang dull moments.",
  "Thanks sa organizers for this wonderful experience.",
  "Love the venue, sobrang comfy.",
  "Very informative, madami akong nakuha na tips.",
  "Highly recommended sa mga ibang students.",
  "Medyo bitin pero super worth it.",
  "Great job guys, ang ganda ng execution."
];

const negativeComments = [
  // English
  "The event started very late, which was frustrating.",
  "The venue was too hot and crowded.",
  "I couldn't hear the speaker properly from the back.",
  "The topics were boring and outdated.",
  "Food ran out before everyone could eat.",
  "Registration process was very disorganized.",
  "Waste of time, I didn't learn anything new.",
  "Technical issues kept interrupting the presentation.",
  "The seats were uncomfortable for a long event.",
  "Staff were rude when I asked for assistance.",
  // Tagalog
  "Sobrang init sa venue, sira yata aircon.",
  "Ang gulo ng pila sa registration.",
  "Hindi masarap ang pagkain, parang panis na.",
  "Sayang lang ang oras ko dito.",
  "Ang ingay ng mga tao sa likod, hindi makarinig.",
  "Late nagsimula, late din natapos.",
  "Walang kwenta yung topic, hindi connected sa amin.",
  "Masungit yung nag-aassist sa entrance.",
  "Madumi ang CR, walang tubig.",
  "Hindi nasunod ang schedule, gulo-gulo.",
  // Taglish
  "Very disappointing, ang gulo ng organizers.",
  "Super init, I can't concentrate.",
  "Ang boring ng speakers, antok na antok ako.",
  "Bad experience, ang tagal ng waiting time.",
  "Not worth it, sana nag-aral na lang ako.",
  "Ang hina ng mic, hindi marinig sa likod.",
  "Walang coordination, kanya-kanya sila.",
  "Sira ang projector, ang tagal inayos.",
  "Very unprofessional ang dating ng event.",
  "Medyo fail ang execution ngayon."
];

const neutralComments = [
  // English
  "The event was okay, nothing special.",
  "Some sessions were good, others were boring.",
  "It was an average experience.",
  "The venue was fine but could be better.",
  "Registration was fast but the event started late.",
  "Content was basic, expected more advanced topics.",
  "Food was okay, but portion was small.",
  "Speakers were average.",
  "Good effort but needs improvement.",
  "It ended a bit early.",
  // Tagalog
  "Okay naman, pwede na.",
  "Sakto lang, hindi masyadong maganda, hindi rin pangit.",
  "Medyo matagal pero okay lang.",
  "Ayos naman ang venue, medyo mainit lang.",
  "Pwede na rin pagtiyagaan.",
  "Hindi ko masyadong nagustuhan pero may natutunan naman.",
  "Sana mas maganda sa susunod.",
  "Okay lang yung pagkain.",
  "Karaniwan lang na seminar.",
  "Medyo magulo pero nairaos naman.",
  // Taglish
  "It was fine, medyo boring lang sa gitna.",
  "Okay naman overall, pero may technical glitches.",
  "Average lang, nothing new.",
  "Expected more, pero okay na rin.",
  "Medyo late nag-start pero okay naman natapos.",
  "Good topics, pero medyo dragging magsalita yung iba.",
  "Not bad, pero not great either.",
  "Sakto lang yung experience.",
  "Pwede na, at least may snacks.",
  "Okay lang, attendance lang habol ko."
];

// --- Helper Functions ---

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

const generateEmail = (firstName, lastName) => {
  const domains = ["gmail.com", "yahoo.com", "student.lvcc.edu.ph", "outlook.com"];
  const randomNum = Math.floor(Math.random() * 9999);
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomNum}@${getRandomElement(domains)}`;
};

const generateRandomDate = (daysAgo = 60) => {
  const now = new Date();
  const randomDays = Math.floor(Math.random() * daysAgo);
  return new Date(now.getTime() - randomDays * 24 * 60 * 60 * 1000);
};

// --- Main Seed Function ---

const seedCustomerRequest = async () => {
  try {
    await connectDB();
    console.log("Connected to MongoDB");

    // 1. Create Event
    const event = await Event.create({
      title: "Annual Student Convention 2026",
      description: "A gathering of students from all departments for learning and development.",
      startDate: new Date(),
      endDate: new Date(new Date().getTime() + 8 * 60 * 60 * 1000), // 8 hours later
      venue: "Main Auditorium",
      organizer: "Student Affairs",
    });
    console.log(`Created Event: ${event.title}`);

    // 2. Create Form
    // Find an admin user to be the creator
    const adminUser = await User.findOne({ role: "mis" }) || await User.findOne();
    
    const form = new Form({
      title: "Seeded Event Evaluation (Customer Request)",
      description: "Evaluation form for the Annual Student Convention. Please rate your experience.",
      status: "published",
      type: "evaluation",
      createdBy: adminUser._id,
      publishedAt: new Date(),
      sections: [{ id: "main", title: "General Evaluation", description: "Overall feedback" }],
      questions: [
        {
          title: "How satisfied are you with the event?",
          type: "scale",
          required: true,
          low: 1,
          high: 5,
          lowLabel: "Very Dissatisfied",
          highLabel: "Very Satisfied",
          sectionId: "main"
        },
        {
          title: "What are your thoughts on the event?",
          type: "paragraph",
          required: true,
          sectionId: "main"
        },
        {
          title: "Will you attend next year?",
          type: "multiple_choice",
          options: ["Yes", "No", "Maybe"],
          required: true,
          sectionId: "main"
        }
      ],
    });

    console.log(`Created Form structure: ${form.title}`);

    // 3. Generate Attendees and Responses
    const attendees = [];
    const responses = [];

    // Target counts
    const totalAttendees = 500;
    const sentimentTargets = {
        positive: 50,
        negative: 50,
        neutral: 50,
        random: 350
    };

    // Counters
    let currentCounts = {
        positive: 0,
        negative: 0,
        neutral: 0,
        random: 0
    };

    // Helper to pick sentiment type for current iteration
    const pickSentimentType = () => {
        const types = Object.keys(sentimentTargets);
        // Filter types that haven't met target
        const availableTypes = types.filter(t => currentCounts[t] < sentimentTargets[t]);
        if (availableTypes.length === 0) return 'random';
        // Prioritize specific sentiments first
        if (availableTypes.includes('positive')) return 'positive';
        if (availableTypes.includes('negative')) return 'negative';
        if (availableTypes.includes('neutral')) return 'neutral';
        return 'random';
    };

    for (let i = 0; i < totalAttendees; i++) {
        // Demographics
        const isHigherEd = i % 2 === 0; // 50-50 split roughly
        const dept = isHigherEd ? getRandomElement(departments.slice(0, 4)) : getRandomElement(departments.slice(4));
        const prog = isHigherEd ? getRandomElement(programs) : (dept.includes("Senior") ? "STEM" : "Grade 10");
        
        const firstName = getRandomElement(firstNames);
        const lastName = getRandomElement(lastNames);
        const email = generateEmail(firstName, lastName);

        // Add to attendees list
        attendees.push({
            name: `${firstName} ${lastName}`,
            email: email,
            department: dept,
            yearLevel: isHigherEd ? `${Math.floor(Math.random() * 4) + 1}th Year` : "High School",
            program: prog,
            hasResponded: true,
            uploadedAt: new Date()
        });

        // Determine Sentiment
        const sentimentType = pickSentimentType();
        currentCounts[sentimentType]++;

        let rating, comment;

        if (sentimentType === 'positive') {
            rating = 5; // or 4
            comment = getRandomElement(positiveComments);
        } else if (sentimentType === 'negative') {
            rating = 1; // or 2
            comment = getRandomElement(negativeComments);
        } else if (sentimentType === 'neutral') {
            rating = 3;
            comment = getRandomElement(neutralComments);
        } else {
            // Random
             rating = Math.floor(Math.random() * 5) + 1;
             if (rating >= 4) comment = getRandomElement(positiveComments);
             else if (rating === 3) comment = getRandomElement(neutralComments);
             else comment = getRandomElement(negativeComments);
        }

        // Create Response
        const formResponse = {
            respondentEmail: email,
            respondentName: `${firstName} ${lastName}`,
            submittedAt: generateRandomDate(60), // Random date within last 60 days
            responses: [
                {
                    questionId: form.questions[0]._id, // Scale
                    questionTitle: form.questions[0].title,
                    answer: rating,
                    sectionId: "main"
                },
                 {
                    questionId: form.questions[1]._id, // Paragraph
                    questionTitle: form.questions[1].title,
                    answer: comment,
                    sectionId: "main"
                },
                 {
                    questionId: form.questions[2]._id, // MC
                    questionTitle: form.questions[2].title,
                    answer: rating >= 4 ? "Yes" : (rating <= 2 ? "No" : "Maybe"),
                    sectionId: "main"
                }
            ]
        };

        responses.push(formResponse);
    }

    form.attendeeList = attendees;
    form.responses = responses;
    form.responseCount = responses.length;

    await form.save();
    console.log(`Successfully saved form with ${responses.length} responses and ${attendees.length} attendees.`);
    console.log(`Sentiment Distribution (Planned):`, currentCounts);

    process.exit(0);
  } catch (error) {
    console.error("Error seeding:", error);
    process.exit(1);
  }
};

seedCustomerRequest();
