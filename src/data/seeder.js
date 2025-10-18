const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../utils/db");

const users = [
  { name: "PSAS User", email: "psas.user@example.com", googleId: "googleid01", role: "psas" },
  { name: "Club Officer User", email: "club.officer.user@example.com", googleId: "googleid02", role: "club-officer" },
  { name: "Participant User", email: "participant.user@example.com", googleId: "googleid03", role: "participant" },
  { name: "School Admin User", email: "school.admin.user@example.com", googleId: "googleid04", role: "school-admin" },
  { name: "MIS User", email: "mis.user@example.com", googleId: "googleid05", role: "mis" },
];

const events = [
  { name: 'Tech Conference 2025', date: new Date('2025-10-20') },
  { name: 'Tech Conference 2024', date: new Date('2024-10-22') },
  { name: 'Tech Conference 2023', date: new Date('2023-10-18') },
  { name: 'Tech Conference 2022', date: new Date('2022-10-15') },
];

const feedbacks = [
  // English Feedbacks (Mix of positive, neutral, and negative)
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
    rating: 2,
    comment:
      "Very disappointed with the overall experience. Poor organization and unprofessional staff.",
  },
  {
    rating: 1,
    comment:
      "Complete waste of time. The speakers were unprepared and the content was outdated.",
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
  {
    rating: 2,
    comment:
      "The venue was terrible - too hot, uncomfortable seating, and poor acoustics.",
  },
  {
    rating: 1,
    comment:
      "Horrible experience. The event started late and many sessions were cancelled without notice.",
  },
  {
    rating: 3,
    comment:
      "Mediocre at best. Expected more from a professional conference.",
  },
  // Tagalog Feedbacks (Mix of positive, neutral, and negative)
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
    rating: 2,
    comment:
      "Nakakadismaya ang karanasan. Walang proper na organization at ang mga staff ay hindi professional.",
  },
  {
    rating: 1,
    comment:
      "Sayang ang oras at pera. Ang mga speakers ay hindi handa at ang nilalaman ay luma na.",
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
  {
    rating: 2,
    comment:
      "Ang venue ay kakila-kilabot - sobrang init, hindi komportable ang mga upuan, at masamang acoustics.",
  },
  {
    rating: 1,
    comment:
      "Kakila-kilabot na karanasan. Late ang simula ng event at maraming sessions ang kinansela nang walang abiso.",
  },
  {
    rating: 3,
    comment:
      "Mediocre lamang. Inaasahan ko pa naman na mas maganda sana.",
  },
];

const seedDB = async () => {
  await connectDB();

  // Import models after database connection is established
  const User = require("../models/User");
  const Event = require("../models/Event");
  const Feedback = require("../models/Feedback");

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

    // Add comprehensive historical data for comparison across multiple years
    const techConference2024 = createdEvents.find(e => e.name === 'Tech Conference 2024');
    const techConference2023 = createdEvents.find(e => e.name === 'Tech Conference 2023');
    const techConference2022 = createdEvents.find(e => e.name === 'Tech Conference 2022');

    // 2024 Feedbacks (Previous year - 10 feedbacks for good comparison)
    const feedbacks2024 = [
      // English feedbacks for 2024
      { rating: 4, comment: 'Great conference last year. The audio quality could be improved.', userId: createdUsers[0 % createdUsers.length]._id, eventId: techConference2024._id },
      { rating: 5, comment: 'The 2024 event was fantastic! Very informative sessions.', userId: createdUsers[1 % createdUsers.length]._id, eventId: techConference2024._id },
      { rating: 2, comment: 'Poor organization last year. Many sessions started late and the venue was inadequate.', userId: createdUsers[2 % createdUsers.length]._id, eventId: techConference2024._id },
      { rating: 1, comment: 'Terrible experience in 2024. The speakers were boring and content was irrelevant.', userId: createdUsers[3 % createdUsers.length]._id, eventId: techConference2024._id },
      { rating: 3, comment: 'Average conference. Nothing special, but not terrible either.', userId: createdUsers[4 % createdUsers.length]._id, eventId: techConference2024._id },
      // Tagalog feedbacks for 2024
      { rating: 5, comment: 'Napakahusay ng konferensya noong nakaraang taon. Sana mas maganda ang audio quality.', userId: createdUsers[5 % createdUsers.length]._id, eventId: techConference2024._id },
      { rating: 4, comment: 'Maganda ang mga presentasyon. Ang mga upuan ay medyo hindi komfortable.', userId: createdUsers[6 % createdUsers.length]._id, eventId: techConference2024._id },
      { rating: 2, comment: 'Mahinang organisasyon noong 2024. Maraming sessions ang late at maliit ang venue.', userId: createdUsers[7 % createdUsers.length]._id, eventId: techConference2024._id },
      { rating: 1, comment: 'Kakila-kilabot na karanasan noong 2024. Ang mga speakers ay nakakainip at ang nilalaman ay irrelevant.', userId: createdUsers[8 % createdUsers.length]._id, eventId: techConference2024._id },
      { rating: 3, comment: 'Average lamang ang conference. Hindi espesyal pero hindi rin naman kakila-kilabot.', userId: createdUsers[9 % createdUsers.length]._id, eventId: techConference2024._id },
    ];

    // 2023 Feedbacks (2 years ago - 8 feedbacks)
    const feedbacks2023 = [
      { rating: 3, comment: 'The 2023 conference was decent. More hands-on workshops would be better.', userId: createdUsers[0 % createdUsers.length]._id, eventId: techConference2023._id },
      { rating: 4, comment: 'Good selection of speakers. The lunch break was too short.', userId: createdUsers[1 % createdUsers.length]._id, eventId: techConference2023._id },
      { rating: 5, comment: 'Excellent technical content. Very well organized event.', userId: createdUsers[2 % createdUsers.length]._id, eventId: techConference2023._id },
      { rating: 2, comment: 'Poor experience in 2023. The venue was terrible and staff was unhelpful.', userId: createdUsers[3 % createdUsers.length]._id, eventId: techConference2023._id },
      { rating: 1, comment: 'Worst conference I attended that year. Complete waste of time and money.', userId: createdUsers[4 % createdUsers.length]._id, eventId: techConference2023._id },
      { rating: 4, comment: 'Magandang nilalaman ang 2023 conference. Sana mas maraming praktikal na aktibidad.', userId: createdUsers[5 % createdUsers.length]._id, eventId: techConference2023._id },
      { rating: 3, comment: 'Mabuti ang mga speakers pero kulang sa interactive sessions.', userId: createdUsers[6 % createdUsers.length]._id, eventId: techConference2023._id },
      { rating: 2, comment: 'Mahinang karanasan noong 2023. Ang venue ay kakila-kilabot at ang staff ay hindi helpful.', userId: createdUsers[7 % createdUsers.length]._id, eventId: techConference2023._id },
    ];

    // 2022 Feedbacks (3 years ago - 6 feedbacks)
    const feedbacks2022 = [
      { rating: 4, comment: 'The 2022 event was well-executed. Great learning experience overall.', userId: createdUsers[0 % createdUsers.length]._id, eventId: techConference2022._id },
      { rating: 2, comment: 'Poor organization in 2022. The virtual platform was buggy and speakers were unprepared.', userId: createdUsers[1 % createdUsers.length]._id, eventId: techConference2022._id },
      { rating: 1, comment: 'Terrible experience. The conference was a complete disaster with technical failures.', userId: createdUsers[2 % createdUsers.length]._id, eventId: techConference2022._id },
      { rating: 4, comment: 'Good mix of theory and practice. The materials were helpful.', userId: createdUsers[3 % createdUsers.length]._id, eventId: techConference2022._id },
      { rating: 3, comment: 'Average experience. The virtual platform had some issues.', userId: createdUsers[4 % createdUsers.length]._id, eventId: techConference2022._id },
      { rating: 2, comment: 'Mahinang organisasyon noong 2022. Ang virtual platform ay buggy at ang mga speakers ay hindi handa.', userId: createdUsers[5 % createdUsers.length]._id, eventId: techConference2022._id },
    ];

    const historicalFeedbacks = [...feedbacks2024, ...feedbacks2023, ...feedbacks2022];

    await Feedback.insertMany([...allFeedbacksForMainEvent, ...historicalFeedbacks]);

    console.log("Data seeded successfully");
    process.exit();
  } catch (error) {
    console.error("Error seeding data:", error);
    process.exit(1);
  }
};

seedDB();
