const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../utils/db");

// Form titles for comparison
const PREVIOUS_YEAR_TITLE = "200 Attendees Mixed Departments Event - 2025";
const CURRENT_YEAR_TITLE = "200 Attendees Mixed Departments Event - 2026";

// Positive Comments - Mixed Tagalog, English, and Taglish (50 total)
const positiveComments = [
  // English
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
  "The event exceeded my expectations. Very well done!",
  "Great food, great venue, great speakers. Perfect!",
  "Highly engaging and educational. Thank you for this opportunity!",
  "Impressed with the attention to detail and professionalism.",
  "Fantastic event! Best learning experience so far.",

  // Tagalog
  "Napakaganda ng event! Marami akong natutunan at nakita.",
  "Sobrang informative ng mga sessions. Salamat sa opportunity!",
  "Magandang karanasan! Ang mga speaker ay tunay na eksperto.",
  "Perpekto ang pagpapatupad ng event. Walang kapintasan!",
  "Nakita ko ang dedikasyon ng organizers. Very impressive talaga!",
  "Ang venue ay world-class! Komportable at maganda ang setup.",
  "Talagang sulit ang oras ko dito. Babalik ako sa next event!",
  "Napakataas ng kalidad ng speakers at program. Bravo!",
  "Ang aming experience ay sobrang positibo at educational.",
  "May sense of professionalism ang buong event. Congratulations!",
  "Napakasaya at nakatulong talaga ang mga learnings dito.",
  "Ang best part ay ang networking opportunities na nabigay.",
  "Sobrang organized ng registration at flow ng event.",
  "Nakaappreciate kami ng effort ng entire team. Excellent job!",
  "Hindi makakalimutan ko ang event na ito. Highly recommended!",

  // Taglish
  "Very informative talaga ang event. Ang speakers ay amazing!",
  "Napaka-organize ng program at sobrang productive ang sessions.",
  "Ang venue is beautiful at kumportable. Maganda ang experience!",
  "Excellent presentation ng content. Naintindihan ko ng mabuti.",
  "Ang team did an outstanding job. Very professional setup talaga!",
  "Informative at engaging ang bawat session. Worth attending!",
  "Superb organization! Ang catering ay masarap na masarap!",
  "The speakers shared valuable insights na very helpful talaga.",
  "Ang timing ng event ay perpekto. Everything is well-planned.",
  "Walang sayang na oras. Productive at masaya ang experience!",
];

// Neutral Comments - Mixed (50 total)
const neutralComments = [
  // English
  "The event was okay. Some sessions were better than others.",
  "Good overall, but the venue could be improved.",
  "Decent event. The registration process was a bit slow.",
  "Average experience. Expected more interactive sessions.",
  "The content was relevant but the timing could be better.",
  "Some speakers were great, others were just okay.",
  "Not bad, but I've been to better events before.",
  "The event met my expectations, nothing more, nothing less.",
  "The sessions were informative but a bit too long.",
  "Good effort by the organizers. Room for improvement.",
  "Satisfactory event. Could use more hands-on activities.",
  "The venue was nice but the seats were uncomfortable.",
  "Some technical issues but manageable overall.",
  "Average event with some highlights here and there.",
  "The topics were relevant but the delivery could be better.",

  // Tagalog
  "Okay lang ang event. Medyo mahaba ang waiting time.",
  "Ang program ay maganda pero may mga kulang pa.",
  "Natutunan ko ang ilang things, pero hindi lahat relevant.",
  "Average quality ng speakers. Ilan lang ang talaga exciting.",
  "Ang venue ay okey na, pero crowded ang iba't ibang areas.",
  "Good attempt ng organizers pero may room for improvement.",
  "Medyo interesting ang topics pero execution ay kailangan better.",
  "Hindi ako fully satisfied pero okay naman overall.",
  "Ang structure ng event ay logical pero timing ay off.",
  "Some parts were great, iba naman ay mediocre lang.",
  "Decent ang catering pero ang venue ay medyo mainit.",
  "Ang speakers ay may knowledge pero presentation ay boring.",
  "Nakatulong but not as much as I expected honestly.",
  "Ang event ay okay para sa expectations ko.",
  "Maraming learnings pero may parts na repetitive.",

  // Taglish
  "Okay lang ang event. Some parts were really good, iba hindi.",
  "Ang venue ay maganda but crowded kasi maraming attendees.",
  "The speakers ay knowledgeable but ang delivery ay monotone.",
  "Decent experience overall. May improvements needed though.",
  "Ang program ay organized pero timing ay off talaga.",
  "Good content pero ang presentation ay kailangan more engaging.",
  "Nakatulong ang some sessions pero iba ay too basic.",
  "Ang event ay average. Expected more interactive activities.",
  "The topics ay relevant pero ang speakers ay Hindi engaging.",
  "Okay naman ang experience. Nothing extraordinary lang.",
  "Ang setup ay professional pero ang flow ay medyo awkward.",
  "Some highlights pero marami ring disappointing moments.",
  "The event was fine. Could be better sa next time.",
  "Decent overall pero may technical issues na nakasagabal.",
  "Natutunan naman ako pero Hindi ka wow-ed talaga.",
  "Satisfactory lang. Expected more hands-on activities.",
  "Ang quality ay okayish. Some speakers shined, others didn't.",
  "The event served its purpose. Room for improvement pa.",
  "Ang attendance ay worth it pero Hindi remarkable talaga.",
  "Okay experience. Not the best I've attended.",
];

// Negative Comments - Mixed (50 total)
const negativeComments = [
  // English
  "Very disappointed. The event was poorly organized.",
  "The speakers were unprepared and the content was outdated.",
  "Waste of time. Expected much more from this event.",
  "Too crowded and the air conditioning was not working properly.",
  "The event started late and many sessions were cancelled.",
  "Poor audio quality made it hard to hear the speakers.",
  "The food was terrible and the service was slow.",
  "Not worth the registration fee. Very disappointing.",
  "The venue was too small for the number of attendees.",
  "Many technical problems throughout the event.",
  "The schedule was confusing and not followed properly.",
  "Expected professional speakers but got amateurs instead.",
  "Waste of money. Could have stayed in the office.",
  "Horrible experience. Will not attend again.",
  "The speakers lacked knowledge and credibility.",

  // Tagalog
  "Kakila-kilabot ang karanasan. Hindi organized ang event.",
  "Sayang ang oras at pera sa event na ito talaga.",
  "Ang speakers ay unprepared at content ay outdated.",
  "Sobrang crowded! Ang aircon ay hindi sapat sa dami.",
  "Mahigpit ang disorganization. Started 2 hours late!",
  "Ang audio ay napakasama. Hindi namin marinig ang speakers.",
  "Ang pagkain ay hindi masarap at mabagal ang service.",
  "Hindi sulit ang registration fee para sa quality.",
  "Napakaliit ng venue para sa number ng attendees.",
  "Maraming technical problems na nakasagabal sa flow.",
  "Ang itinerary ay hindi sinunod ng organizers.",
  "Inexpect namin professional speakers pero amateurs lang!",
  "Sayang ng oras! Walang halaga ang attendance.",
  "Napakagulo ng event from start to finish.",
  "Ang speakers ay walang proper knowledge ng topics.",

  // Taglish
  "Hindi ako satisfied sa event. Poorly organized talaga.",
  "Ang content ay outdated. Parang old material lang.",
  "Paano sila nag-charge ng fee para sa mediocre event na ito?",
  "Too crowded at ang AC ay tulog. Very uncomfortable.",
  "Ang event started late at maraming sessions na cancelled.",
  "Ang audio quality ay napakagulo. Hindi maintindihan.",
  "The food ay hindi masarap at ang service ay slow.",
  "Not worth my time at money honestly. Very disappointed.",
  "Ang venue ay sobrang liit para sa attendees.",
  "Technical problems throughout. Unprofessional setup.",
  "Ang schedule ay walang segurado. Total confusion!",
  "Expected quality speakers pero mediocre lang talaga.",
  "Biggest mistake attending ito. Sayang talaga.",
  "Napakamess ng execution ng entire event.",
  "Ang speakers ay walang depth ng knowledge.",
  "Overpriced at underdelivered sa lahat ng aspect.",
  "Ang worst event I've attended in years. Terrible.",
  "Disorganized! Ang registration ay sobrang matagal.",
  "Hindi professional ang presentasyon ng speakers.",
  "Regret ko talaga ang pagattend. Never again!",
];

// Department names
const departments = ["Higher Education", "Basic Education"];

// Year levels for higher education
const higherEdYearLevels = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

// Grade levels for basic education
const basicEdGradeLevels = [
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
];

// Generate realistic names
const firstNames = [
  "Juan",
  "Maria",
  "Jose",
  "Ana",
  "Pedro",
  "Rosa",
  "Carlos",
  "Elena",
  "Miguel",
  "Sofia",
  "Antonio",
  "Isabella",
  "Fernando",
  "Camila",
  "Ricardo",
  "Valentina",
  "Eduardo",
  "Gabriela",
  "Luis",
  "Patricia",
  "Daniel",
  "Mariana",
  "Roberto",
  "Andrea",
  "Francisco",
  "Lucia",
  "Alejandro",
  "Carmen",
  "Oscar",
  "Teresa",
  "Marco",
  "Angela",
  "Diego",
  "Rosario",
  "Andres",
  "Francesca",
  "Manuel",
  "Angelica",
  "Vicente",
  "Victoria",
  "Angel",
  "Viviana",
];

const lastNames = [
  "Dela Cruz",
  "Santos",
  "Reyes",
  "Garcia",
  "Gonzales",
  "Martinez",
  "Lopez",
  "Rodriguez",
  "Hernandez",
  "Ramirez",
  "Flores",
  "Torres",
  "Morales",
  "Diaz",
  "Castillo",
  "Romero",
  "Jimenez",
  "Vargas",
  "Mendoza",
  "Navarro",
  "Ramos",
  "Silva",
  "Aguilar",
  "Ortega",
  "Gutierrez",
  "Cruz",
  "Medina",
  "Perez",
  "Sanchez",
  "Fernandez",
  "Valdez",
  "Vega",
  "Ruiz",
  "Fuentes",
  "Cortez",
];

// Generate random email
const generateEmail = (firstName, lastName, department, index) => {
  const domains = [
    "gmail.com",
    "yahoo.com",
    "outlook.com",
    "student.lvcc.edu.ph",
  ];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  const emailBase = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}`;
  return `${emailBase}@${domain}`;
};

// Generate random date within a range
const generateRandomDate = (startDate, endDate) => {
  return new Date(
    startDate.getTime() +
      Math.random() * (endDate.getTime() - startDate.getTime()),
  );
};

// Generate a random rating (1-5) with weighted distribution
const generateRating = () => {
  const weights = [2, 5, 15, 35, 43]; // More 4s and 5s
  const random = Math.random() * 100;
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (random <= cumulative) return i + 1;
  }
  return 5;
};

// Get comment based on rating
const getComment = (rating) => {
  if (rating >= 4) {
    return positiveComments[
      Math.floor(Math.random() * positiveComments.length)
    ];
  } else if (rating === 3) {
    return neutralComments[Math.floor(Math.random() * neutralComments.length)];
  } else {
    return negativeComments[
      Math.floor(Math.random() * negativeComments.length)
    ];
  }
};

const seedComparisonForms = async () => {
  try {
    await connectDB();
    console.log("Connected to Database!");

    const Form = require("../models/Form");
    const User = require("../models/User");

    // Find or create form creator
    const targetEmail = "rodolfojrebajan@student.laverdad.edu.ph";
    let creator = await User.findOne({ email: targetEmail });
    if (!creator) {
      console.log("User not found. Using admin user...");
      creator = await User.findOne({ role: "psas" });
    }

    if (!creator) {
      console.log("No suitable creator found!");
      process.exit(1);
    }

    console.log(`Using creator: ${creator.email}`);

    // Delete existing forms with same titles
    await Form.deleteMany({
      title: { $in: [PREVIOUS_YEAR_TITLE, CURRENT_YEAR_TITLE] },
    });
    console.log(`Cleared previous forms if existed.`);

    // ========================================
    // CREATE PREVIOUS YEAR FORM (2025)
    // ========================================
    console.log("\n📅 Creating PREVIOUS YEAR form (2025)...");

    const prevDate = new Date(2025, 0, 15); // Jan 15, 2025
    const prevCreatedDate = new Date(2025, 0, 1); // Created in 2025
    const prevPublishedDate = new Date(2025, 0, 10); // Published in 2025
    const prevForm = new Form({
      title: PREVIOUS_YEAR_TITLE,
      description:
        "Annual Evaluation Event 2025 - 500 attendees from Higher Education and Basic Education",
      type: "evaluation",
      status: "published",
      createdBy: creator._id,
      eventStartDate: prevDate,
      eventEndDate: new Date(2025, 0, 16),
      createdAt: prevCreatedDate,
      publishedAt: prevPublishedDate,
      questions: [
        {
          title: "Overall Experience Rating",
          type: "scale",
          required: true,
          low: 1,
          high: 5,
          lowLabel: "Poor",
          highLabel: "Excellent",
          sectionId: "main",
        },
        {
          title: "Please share your feedback about the event",
          type: "paragraph",
          required: true,
          sectionId: "main",
        },
      ],
    });

    // Assign real ObjectIds to questions
    prevForm.questions[0]._id = new mongoose.Types.ObjectId();
    prevForm.questions[1]._id = new mongoose.Types.ObjectId();

    // Generate attendees and responses for 2025
    const attendeeList2025 = [];
    const responses2025 = [];
    const dateRangeStart2025 = new Date(2025, 0, 1);
    const dateRangeEnd2025 = new Date(2025, 0, 31);

    // Higher Education (100)
    for (let i = 0; i < 100; i++) {
      const firstName = firstNames[i % firstNames.length];
      const lastName = lastNames[i % lastNames.length];
      const yearLevel = higherEdYearLevels[i % higherEdYearLevels.length];
      const email = generateEmail(firstName, lastName, "HigherEd", i);

      attendeeList2025.push({
        name: `${firstName} ${lastName}`,
        email,
        department: "Higher Education",
        yearLevel,
        hasResponded: true,
      });

      const rating = generateRating();
      const comment = getComment(rating);
      const submittedDate = generateRandomDate(
        dateRangeStart2025,
        dateRangeEnd2025,
      );

      responses2025.push({
        responses: [
          {
            questionId: prevForm.questions[0]._id.toString(),
            questionTitle: prevForm.questions[0].title,
            answer: rating,
            sectionId: "main",
          },
          {
            questionId: prevForm.questions[1]._id.toString(),
            questionTitle: prevForm.questions[1].title,
            answer: comment,
            sectionId: "main",
          },
        ],
        respondentEmail: email,
        respondentName: `${firstName} ${lastName}`,
        submittedAt: submittedDate,
      });

      if ((i + 1) % 50 === 0) {
        console.log(`  ✓ Generated ${i + 1} Higher Education attendees (2025)`);
      }
    }

    // Basic Education (100)
    for (let i = 0; i < 100; i++) {
      const firstName = firstNames[(250 + i) % firstNames.length];
      const lastName = lastNames[(250 + i) % lastNames.length];
      const gradeLevel = basicEdGradeLevels[i % basicEdGradeLevels.length];
      const email = generateEmail(firstName, lastName, "BasicEd", i);

      attendeeList2025.push({
        name: `${firstName} ${lastName}`,
        email,
        department: "Basic Education",
        yearLevel: gradeLevel,
        hasResponded: true,
      });

      const rating = generateRating();
      const comment = getComment(rating);
      const submittedDate = generateRandomDate(
        dateRangeStart2025,
        dateRangeEnd2025,
      );

      responses2025.push({
        responses: [
          {
            questionId: prevForm.questions[0]._id.toString(),
            questionTitle: prevForm.questions[0].title,
            answer: rating,
            sectionId: "main",
          },
          {
            questionId: prevForm.questions[1]._id.toString(),
            questionTitle: prevForm.questions[1].title,
            answer: comment,
            sectionId: "main",
          },
        ],
        respondentEmail: email,
        respondentName: `${firstName} ${lastName}`,
        submittedAt: submittedDate,
      });

      if ((i + 1) % 50 === 0) {
        console.log(`  ✓ Generated ${i + 1} Basic Education attendees (2025)`);
      }
    }

    prevForm.attendeeList = attendeeList2025;
    prevForm.responses = responses2025;
    prevForm.responseCount = responses2025.length;

    await prevForm.save();
    console.log(
      `✅ Created PREVIOUS YEAR form with ${prevForm.responseCount} responses`,
    );

    // ========================================
    // CREATE CURRENT YEAR FORM (2026)
    // ========================================
    console.log("\n📅 Creating CURRENT YEAR form (2026)...");

    const currDate = new Date(2026, 0, 15); // Jan 15, 2026
    const currCreatedDate = new Date(2026, 0, 1); // Created in 2026
    const currPublishedDate = new Date(2026, 0, 10); // Published in 2026
    const currForm = new Form({
      title: CURRENT_YEAR_TITLE,
      description:
        "Annual Evaluation Event 2026 - 500 attendees from Higher Education and Basic Education",
      type: "evaluation",
      status: "published",
      createdBy: creator._id,
      eventStartDate: currDate,
      eventEndDate: new Date(2026, 0, 16),
      createdAt: currCreatedDate,
      publishedAt: currPublishedDate,
      questions: [
        {
          title: "Overall Experience Rating",
          type: "scale",
          required: true,
          low: 1,
          high: 5,
          lowLabel: "Poor",
          highLabel: "Excellent",
          sectionId: "main",
        },
        {
          title: "Please share your feedback about the event",
          type: "paragraph",
          required: true,
          sectionId: "main",
        },
      ],
    });

    // Assign real ObjectIds to questions
    currForm.questions[0]._id = new mongoose.Types.ObjectId();
    currForm.questions[1]._id = new mongoose.Types.ObjectId();

    // Generate attendees and responses for 2026
    const attendeeList2026 = [];
    const responses2026 = [];
    const dateRangeStart2026 = new Date(2026, 0, 1);
    const dateRangeEnd2026 = new Date(2026, 1, 4);

    // Higher Education (100)
    for (let i = 0; i < 100; i++) {
      const firstName = firstNames[i % firstNames.length];
      const lastName = lastNames[i % lastNames.length];
      const yearLevel = higherEdYearLevels[i % higherEdYearLevels.length];
      const email = generateEmail(firstName, lastName, "HigherEd", i);

      attendeeList2026.push({
        name: `${firstName} ${lastName}`,
        email,
        department: "Higher Education",
        yearLevel,
        hasResponded: true,
      });

      const rating = generateRating();
      const comment = getComment(rating);
      const submittedDate = generateRandomDate(
        dateRangeStart2026,
        dateRangeEnd2026,
      );

      responses2026.push({
        responses: [
          {
            questionId: currForm.questions[0]._id.toString(),
            questionTitle: currForm.questions[0].title,
            answer: rating,
            sectionId: "main",
          },
          {
            questionId: currForm.questions[1]._id.toString(),
            questionTitle: currForm.questions[1].title,
            answer: comment,
            sectionId: "main",
          },
        ],
        respondentEmail: email,
        respondentName: `${firstName} ${lastName}`,
        submittedAt: submittedDate,
      });

      if ((i + 1) % 50 === 0) {
        console.log(`  ✓ Generated ${i + 1} Higher Education attendees (2026)`);
      }
    }

    // Basic Education (100)
    for (let i = 0; i < 100; i++) {
      const firstName = firstNames[(250 + i) % firstNames.length];
      const lastName = lastNames[(250 + i) % lastNames.length];
      const gradeLevel = basicEdGradeLevels[i % basicEdGradeLevels.length];
      const email = generateEmail(firstName, lastName, "BasicEd", i);

      attendeeList2026.push({
        name: `${firstName} ${lastName}`,
        email,
        department: "Basic Education",
        yearLevel: gradeLevel,
        hasResponded: true,
      });

      const rating = generateRating();
      const comment = getComment(rating);
      const submittedDate = generateRandomDate(
        dateRangeStart2026,
        dateRangeEnd2026,
      );

      responses2026.push({
        responses: [
          {
            questionId: currForm.questions[0]._id.toString(),
            questionTitle: currForm.questions[0].title,
            answer: rating,
            sectionId: "main",
          },
          {
            questionId: currForm.questions[1]._id.toString(),
            questionTitle: currForm.questions[1].title,
            answer: comment,
            sectionId: "main",
          },
        ],
        respondentEmail: email,
        respondentName: `${firstName} ${lastName}`,
        submittedAt: submittedDate,
      });

      if ((i + 1) % 50 === 0) {
        console.log(`  ✓ Generated ${i + 1} Basic Education attendees (2026)`);
      }
    }

    currForm.attendeeList = attendeeList2026;
    currForm.responses = responses2026;
    currForm.responseCount = responses2026.length;

    await currForm.save();
    console.log(
      `✅ Created CURRENT YEAR form with ${currForm.responseCount} responses`,
    );

    // ========================================
    // SUMMARY
    // ========================================
    console.log("\n✅ Comparison Forms Seeding Completed!");
    console.log("\n📊 Summary:");
    console.log(`\n📅 PREVIOUS YEAR (2025):`);
    console.log(`  Form ID: ${prevForm._id}`);
    console.log(`  Title: "${prevForm.title}"`);
    console.log(`  Total Attendees: 500`);
    console.log(`  - Higher Education: 250 (50%)`);
    console.log(`  - Basic Education: 250 (50%)`);
    console.log(`  Total Responses: ${prevForm.responseCount}`);
    console.log(`  Date Range: Jan 1-31, 2025`);

    console.log(`\n📅 CURRENT YEAR (2026):`);
    console.log(`  Form ID: ${currForm._id}`);
    console.log(`  Title: "${currForm.title}"`);
    console.log(`  Total Attendees: 500`);
    console.log(`  - Higher Education: 250 (50%)`);
    console.log(`  - Basic Education: 250 (50%)`);
    console.log(`  Total Responses: ${currForm.responseCount}`);
    console.log(`  Date Range: Jan 1 - Feb 4, 2026`);

    console.log(`\n🔄 Comparison Features:`);
    console.log(`  ✓ Same structure for easy comparison`);
    console.log(`  ✓ Different year data (2025 vs 2026)`);
    console.log(`  ✓ Both have 500 attendees`);
    console.log(`  ✓ Mixed sentiment comments (positive, neutral, negative)`);
    console.log(`  ✓ Ready for year-over-year analytics`);

    process.exit(0);
  } catch (error) {
    console.error("Error seeding comparison forms:", error);
    process.exit(1);
  }
};

// Run the seeder
seedComparisonForms();
