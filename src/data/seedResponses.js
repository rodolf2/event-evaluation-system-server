const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../utils/db");

// Sample participant names for realistic responses
const participantNames = [
  "Juan Dela Cruz",
  "Maria Santos",
  "Jose Reyes",
  "Ana Garcia",
  "Pedro Gonzales",
  "Rosa Martinez",
  "Carlos Lopez",
  "Elena Rodriguez",
  "Miguel Hernandez",
  "Sofia Ramirez",
  "Antonio Flores",
  "Isabella Torres",
  "Fernando Morales",
  "Camila Diaz",
  "Ricardo Castillo",
  "Valentina Romero",
  "Eduardo Jimenez",
  "Gabriela Vargas",
  "Luis Mendoza",
  "Patricia Navarro",
  "Daniel Ramos",
  "Mariana Silva",
  "Roberto Aguilar",
  "Andrea Ortega",
  "Francisco Gutierrez",
  "Lucia Cruz",
  "Alejandro Medina",
  "Carmen Perez",
  "Oscar Sanchez",
  "Teresa Fernandez",
];

// Sample email domains
const emailDomains = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "student.lvcc.edu.ph",
];

// Positive comments
const positiveComments = [
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
  "Napakaganda ng event! Marami akong natutunan.",
  "Sobrang informative ng mga sessions. Very helpful!",
  "The event exceeded my expectations. Very well done!",
  "Great food, great venue, great speakers. Perfect!",
  "Highly engaging and educational. Thank you for this opportunity!",
];

// Neutral comments
const neutralComments = [
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
  "Good effort by the organizers. Room for improvement.",
  "Satisfactory event. Could use more hands-on activities.",
  "The venue was nice but the seats were uncomfortable.",
  "Some technical issues but manageable overall.",
  "Average event with some highlights here and there.",
];

// Negative comments
const negativeComments = [
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
  "Many technical problems throughout the event.",
  "The schedule was confusing and not followed properly.",
  "Expected professional speakers but got amateurs instead.",
  "The event felt rushed and disorganized.",
  "Very poor planning. Will not attend again.",
];

// Generate a random email
const generateEmail = (name) => {
  const nameParts = name.toLowerCase().split(" ");
  const domain = emailDomains[Math.floor(Math.random() * emailDomains.length)];
  const randomNum = Math.floor(Math.random() * 1000);
  return `${nameParts[0]}.${nameParts[1]}${randomNum}@${domain}`;
};

// Generate random rating (1-5) with weighted distribution
const generateRating = () => {
  const weights = [5, 10, 20, 35, 30]; // More 4s and 5s
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

// Generate random date within past days
const generateRandomDate = (daysAgo = 30) => {
  const now = new Date();
  const randomDays = Math.floor(Math.random() * daysAgo);
  return new Date(now.getTime() - randomDays * 24 * 60 * 60 * 1000);
};

const seedFormResponses = async () => {
  await connectDB();

  const Form = require("../models/Form");

  try {
    // Find all published forms
    const publishedForms = await Form.find({ status: "published" });

    if (publishedForms.length === 0) {
      console.log(
        "No published forms found. Please create and publish a form first."
      );
      console.log("Creating a sample form with responses...");

      // If no forms exist, we'll just log and exit
      process.exit(0);
    }

    console.log(
      `Found ${publishedForms.length} published form(s). Adding responses...`
    );

    for (const form of publishedForms) {
      console.log(`\nProcessing form: "${form.title}"`);

      // Find scale/rating questions and paragraph questions
      const scaleQuestions = form.questions.filter((q) => q.type === "scale");
      const paragraphQuestions = form.questions.filter(
        (q) => q.type === "paragraph" || q.type === "short_answer"
      );
      const mcQuestions = form.questions.filter(
        (q) => q.type === "multiple_choice"
      );

      // Generate 50-100 responses per form
      const numResponses = Math.floor(Math.random() * 51) + 50; // 50-100 responses
      const newResponses = [];

      for (let i = 0; i < numResponses; i++) {
        const respondentName =
          participantNames[Math.floor(Math.random() * participantNames.length)];
        const respondentEmail = generateEmail(respondentName);
        const rating = generateRating();
        const comment = getComment(rating);
        const submittedAt = generateRandomDate(60);

        const responses = [];

        // Add responses for each question
        for (const question of form.questions) {
          let answer;

          switch (question.type) {
            case "scale":
              // Use weighted rating
              answer = rating;
              break;
            case "paragraph":
            case "short_answer":
              // Use appropriate comment
              answer = comment;
              break;
            case "multiple_choice":
              // Pick random option
              if (question.options && question.options.length > 0) {
                answer =
                  question.options[
                    Math.floor(Math.random() * question.options.length)
                  ];
              } else {
                answer = "Yes";
              }
              break;
            case "date":
              answer = new Date().toISOString().split("T")[0];
              break;
            case "time":
              answer = "14:00";
              break;
            default:
              answer = "Sample response";
          }

          responses.push({
            questionId: question._id.toString(),
            questionTitle: question.title,
            answer: answer,
            sectionId: question.sectionId || "main",
          });
        }

        newResponses.push({
          responses,
          respondentEmail,
          respondentName,
          submittedAt,
        });
      }

      // Add responses to form
      form.responses = [...form.responses, ...newResponses];
      form.responseCount = form.responses.length;

      // Update attendee list hasResponded status
      for (const response of newResponses) {
        const attendee = form.attendeeList.find(
          (a) =>
            a.email.toLowerCase() === response.respondentEmail.toLowerCase()
        );
        if (attendee) {
          attendee.hasResponded = true;
        }
      }

      await form.save();
      console.log(
        `  Added ${numResponses} responses. Total responses: ${form.responseCount}`
      );
    }

    console.log("\n✅ Seeding completed successfully!");
    console.log(
      "The forms now have realistic test data with comments and ratings."
    );
    process.exit(0);
  } catch (error) {
    console.error("Error seeding responses:", error);
    process.exit(1);
  }
};

seedFormResponses();
