const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../utils/db");
const User = require("../models/User");
const Event = require("../models/Event");
const Feedback = require("../models/Feedback");

const users = [
  { name: "John Doe", email: "john.doe@example.com", googleId: "googleid01" },
  {
    name: "Jane Smith",
    email: "jane.smith@example.com",
    googleId: "googleid02",
  },
  {
    name: "Peter Jones",
    email: "peter.jones@example.com",
    googleId: "googleid03",
  },
  {
    name: "Mary Williams",
    email: "mary.williams@example.com",
    googleId: "googleid04",
  },
  {
    name: "David Brown",
    email: "david.brown@example.com",
    googleId: "googleid05",
  },
  {
    name: "Juan Dela Cruz",
    email: "juan.delacruz@example.com",
    googleId: "googleid06",
  },
  {
    name: "Maria Santos",
    email: "maria.santos@example.com",
    googleId: "googleid07",
  },
  {
    name: "Andres Bonifacio",
    email: "andres.bonifacio@example.com",
    googleId: "googleid08",
  },
  {
    name: "Jose Rizal",
    email: "jose.rizal@example.com",
    googleId: "googleid09",
  },
  {
    name: "Gabriela Silang",
    email: "gabriela.silang@example.com",
    googleId: "googleid10",
  },
];

const events = [
  { name: 'Tech Conference 2025', date: new Date('2025-10-20') },
  { name: 'Tech Conference 2024', date: new Date('2024-10-22') },
];

const feedbacks = [
  // English Feedbacks (Realistic, natural language)
  {
    rating: 5,
    comment:
      "The event was very well-organized and informative. The food could have been better though.",
  },
  {
    rating: 4,
    comment:
      "I learned a lot from the speakers. The venue was a bit crowded.",
  },
  {
    rating: 5,
    comment:
      "The networking opportunities were excellent. The registration process was slow.",
  },
  {
    rating: 3,
    comment:
      "The topics were relevant. Some sessions were too long.",
  },
  {
    rating: 4,
    comment:
      "The staff was very helpful. The Wi-Fi was unreliable.",
  },
  // Tagalog Feedbacks (Realistic, natural language)
  {
    rating: 5,
    comment:
      "Napakaganda ng pagkaka-organisa ng event. Sana mas marami pang pagkain sa susunod.",
  },
  {
    rating: 4,
    comment:
      "Marami akong natutunan sa mga tagapagsalita. Medyo masikip sa venue.",
  },
  {
    rating: 5,
    comment:
      "Maganda ang pagkakataon na makipag-ugnayan sa iba. Mabagal ang proseso ng pagpaparehistro.",
  },
  {
    rating: 3,
    comment:
      "Angkop ang mga paksa. Masyadong mahaba ang ilang sesyon.",
  },
  {
    rating: 4,
    comment:
      "Napakabait ng mga staff. Hindi maaasahan ang Wi-Fi.",
  },
];

const seedDB = async () => {
  await connectDB();

  try {
    // Drop existing indexes that might cause conflicts
    try {
      await Feedback.collection.dropIndexes();
    } catch (e) {
      console.log("No custom indexes to drop");
    }

    // Clear existing data (in order due to dependencies)
    await Feedback.deleteMany({});
    await Event.deleteMany({});
    await User.deleteMany({});

    // Seed users and events
    const createdUsers = await User.insertMany(users);
    const createdEvents = await Event.insertMany(events);

    // Use the main event for all current feedback (easier testing)
    const techConference2025 = createdEvents.find(e => e.name === 'Tech Conference 2025');

    // Create multiple feedbacks for the main event
    const allFeedbacksForMainEvent = feedbacks.map((feedback, index) => ({
      ...feedback,
      userId: createdUsers[index % createdUsers.length]._id,
      eventId: techConference2025._id,
    }));

    // Add some historical data for comparison
    const techConference2024 = createdEvents.find(e => e.name === 'Tech Conference 2024');
    const historicalFeedbacks = [
      { rating: 4, comment: 'Great conference last year. The audio quality could be improved.', userId: createdUsers[0]._id, eventId: techConference2024._id },
      { rating: 5, comment: 'The 2024 event was fantastic! Very informative sessions.', userId: createdUsers[1]._id, eventId: techConference2024._id },
      { rating: 3, comment: 'It was okay, could be better. The schedule was too packed.', userId: createdUsers[2]._id, eventId: techConference2024._id },
      { rating: 4, comment: 'I enjoyed the keynote speaker. Good variety of topics.', userId: createdUsers[3]._id, eventId: techConference2024._id },
    ];

    await Feedback.insertMany([...allFeedbacksForMainEvent, ...historicalFeedbacks]);

    console.log("Data seeded successfully");
    process.exit();
  } catch (error) {
    console.error("Error seeding data:", error);
    process.exit(1);
  }
};

seedDB();
