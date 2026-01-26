const connectDB = require("../utils/db");
const Lexicon = require("../models/Lexicon");
require("dotenv").config();

const initialLexicon = [
  // POSITIVE ENGLISH
  { word: "good", sentiment: "positive", weight: 1.0, language: "en" },
  { word: "great", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "excellent", sentiment: "positive", weight: 2.0, language: "en" },
  { word: "amazing", sentiment: "positive", weight: 2.0, language: "en" },
  { word: "wonderful", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "fantastic", sentiment: "positive", weight: 2.0, language: "en" },
  { word: "awesome", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "perfect", sentiment: "positive", weight: 2.0, language: "en" },
  { word: "love", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "enjoy", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "informative", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "helpful", sentiment: "positive", weight: 1.0, language: "en" },
  {
    word: "well-organized",
    sentiment: "positive",
    weight: 1.5,
    language: "en",
  },

  // POSITIVE TAGALOG
  { word: "maganda", sentiment: "positive", weight: 1.0, language: "tl" },
  { word: "mahusay", sentiment: "positive", weight: 1.5, language: "tl" },
  { word: "galing", sentiment: "positive", weight: 1.5, language: "tl" },
  { word: "ayos", sentiment: "positive", weight: 1.0, language: "tl" },
  { word: "sulit", sentiment: "positive", weight: 1.5, language: "tl" },
  { word: "masaya", sentiment: "positive", weight: 1.0, language: "tl" },
  { word: "napakaganda", sentiment: "positive", weight: 2.0, language: "tl" },
  {
    word: "sobrang ganda",
    sentiment: "positive",
    weight: 2.0,
    language: "tl",
    isPhrase: true,
  },
  {
    word: "maraming salamat",
    sentiment: "positive",
    weight: 2.0,
    language: "tl",
    isPhrase: true,
  },

  // NEGATIVE ENGLISH
  { word: "bad", sentiment: "negative", weight: 1.0, language: "en" },
  { word: "terrible", sentiment: "negative", weight: 1.5, language: "en" },
  { word: "awful", sentiment: "negative", weight: 1.5, language: "en" },
  { word: "horrible", sentiment: "negative", weight: 1.5, language: "en" },
  { word: "hate", sentiment: "negative", weight: 1.5, language: "en" },
  { word: "worst", sentiment: "negative", weight: 2.0, language: "en" },
  { word: "disappointed", sentiment: "negative", weight: 1.0, language: "en" },
  { word: "boring", sentiment: "negative", weight: 1.0, language: "en" },
  { word: "disorganized", sentiment: "negative", weight: 1.5, language: "en" },
  {
    word: "waste of time",
    sentiment: "negative",
    weight: 2.0,
    language: "en",
    isPhrase: true,
  },

  // NEGATIVE TAGALOG
  { word: "masama", sentiment: "negative", weight: 1.0, language: "tl" },
  { word: "pangit", sentiment: "negative", weight: 1.0, language: "tl" },
  { word: "nakakainis", sentiment: "negative", weight: 1.0, language: "tl" },
  { word: "galit", sentiment: "negative", weight: 1.0, language: "tl" },
  {
    word: "walang kwenta",
    sentiment: "negative",
    weight: 2.0,
    language: "tl",
    isPhrase: true,
  },
  { word: "sayang", sentiment: "negative", weight: 1.0, language: "tl" },
  {
    word: "hindi maganda",
    sentiment: "negative",
    weight: 1.5,
    language: "tl",
    isPhrase: true,
  },
];

async function migrate() {
  try {
    await connectDB();
    console.log("Connected to MongoDB");

    // Clear existing lexicon to avoid duplicates during initial setup
    const countBefore = await Lexicon.countDocuments({});
    console.log(`Current lexicon count: ${countBefore}`);

    await Lexicon.deleteMany({});
    console.log("Cleared existing lexicon");

    const result = await Lexicon.insertMany(initialLexicon);
    console.log(`Lexicon migrated successfully: ${result.length} words added`);

    const countAfter = await Lexicon.countDocuments({});
    console.log(`New lexicon count: ${countAfter}`);

    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();
