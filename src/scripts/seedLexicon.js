const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
const Lexicon = require("../models/Lexicon");

const expandedLexicon = [
  // --- POSITIVE ENGLISH ---
  { word: "good", sentiment: "positive", weight: 1.0, language: "en" },
  { word: "great", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "excellent", sentiment: "positive", weight: 2.0, language: "en" },
  { word: "amazing", sentiment: "positive", weight: 2.0, language: "en" },
  { word: "wonderful", sentiment: "positive", weight: 1.8, language: "en" },
  { word: "fantastic", sentiment: "positive", weight: 1.8, language: "en" },
  { word: "awesome", sentiment: "positive", weight: 1.8, language: "en" },
  { word: "perfect", sentiment: "positive", weight: 2.0, language: "en" },
  { word: "love", sentiment: "positive", weight: 2.0, language: "en" },
  { word: "enjoy", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "helpful", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "informative", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "valuable", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "insightful", sentiment: "positive", weight: 1.5, language: "en" },
  {
    word: "well-organized",
    sentiment: "positive",
    weight: 1.8,
    language: "en",
    isPhrase: true,
  },
  { word: "smooth", sentiment: "positive", weight: 1.2, language: "en" },
  { word: "professional", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "efficient", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "effective", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "productive", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "beneficial", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "rewarding", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "worthwhile", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "outstanding", sentiment: "positive", weight: 2.0, language: "en" },
  { word: "brilliant", sentiment: "positive", weight: 1.8, language: "en" },
  { word: "superb", sentiment: "positive", weight: 1.8, language: "en" },
  { word: "marvelous", sentiment: "positive", weight: 1.8, language: "en" },
  { word: "magnificent", sentiment: "positive", weight: 2.0, language: "en" },
  { word: "incredible", sentiment: "positive", weight: 1.8, language: "en" },
  { word: "fabulous", sentiment: "positive", weight: 1.8, language: "en" },
  { word: "splendid", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "terrific", sentiment: "positive", weight: 1.8, language: "en" },
  { word: "phenomenal", sentiment: "positive", weight: 2.0, language: "en" },
  { word: "exceptional", sentiment: "positive", weight: 2.0, language: "en" },
  { word: "remarkable", sentiment: "positive", weight: 1.8, language: "en" },
  { word: "stellar", sentiment: "positive", weight: 1.8, language: "en" },
  {
    word: "top-notch",
    sentiment: "positive",
    weight: 2.0,
    language: "en",
    isPhrase: true,
  },
  {
    word: "world-class",
    sentiment: "positive",
    weight: 2.0,
    language: "en",
    isPhrase: true,
  },
  { word: "happy", sentiment: "positive", weight: 1.2, language: "en" },
  { word: "pleased", sentiment: "positive", weight: 1.2, language: "en" },
  { word: "satisfied", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "delighted", sentiment: "positive", weight: 1.8, language: "en" },
  { word: "thrilled", sentiment: "positive", weight: 1.8, language: "en" },
  { word: "excited", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "grateful", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "thankful", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "appreciate", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "educational", sentiment: "positive", weight: 1.2, language: "en" },
  { word: "inspiring", sentiment: "positive", weight: 1.8, language: "en" },
  { word: "motivating", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "engaging", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "interesting", sentiment: "positive", weight: 1.2, language: "en" },
  { word: "fun", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "entertaining", sentiment: "positive", weight: 1.5, language: "en" },
  {
    word: "well-prepared",
    sentiment: "positive",
    weight: 1.5,
    language: "en",
    isPhrase: true,
  },
  { word: "memorable", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "nice", sentiment: "positive", weight: 1.0, language: "en" },
  { word: "clean", sentiment: "positive", weight: 1.2, language: "en" },
  { word: "clear", sentiment: "positive", weight: 1.2, language: "en" },
  { word: "organized", sentiment: "positive", weight: 1.5, language: "en" },
  { word: "thorough", sentiment: "positive", weight: 1.5, language: "en" },

  // --- POSITIVE TAGALOG ---
  { word: "maganda", sentiment: "positive", weight: 1.2, language: "tl" },
  { word: "mahusay", sentiment: "positive", weight: 1.5, language: "tl" },
  { word: "galing", sentiment: "positive", weight: 1.5, language: "tl" },
  { word: "ayos", sentiment: "positive", weight: 1.0, language: "tl" },
  { word: "sulit", sentiment: "positive", weight: 1.8, language: "tl" },
  { word: "masaya", sentiment: "positive", weight: 1.2, language: "tl" },
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
    weight: 1.5,
    language: "tl",
    isPhrase: true,
  },
  { word: "mabuti", sentiment: "positive", weight: 1.0, language: "tl" },
  {
    word: "kapaki-pakinabang",
    sentiment: "positive",
    weight: 1.8,
    language: "tl",
  },
  { word: "nakatulong", sentiment: "positive", weight: 1.5, language: "tl" },
  { word: "malinaw", sentiment: "positive", weight: 1.2, language: "tl" },
  { word: "mabilis", sentiment: "positive", weight: 1.2, language: "tl" },
  { word: "organisado", sentiment: "positive", weight: 1.5, language: "tl" },
  { word: "maayos", sentiment: "positive", weight: 1.2, language: "tl" },
  { word: "panalo", sentiment: "positive", weight: 1.8, language: "tl" },
  { word: "de-kalidad", sentiment: "positive", weight: 1.8, language: "tl" },
  { word: "hanga", sentiment: "positive", weight: 1.5, language: "tl" },
  { word: "bilib", sentiment: "positive", weight: 1.8, language: "tl" },
  { word: "magaling", sentiment: "positive", weight: 1.5, language: "tl" },
  { word: "napakagaling", sentiment: "positive", weight: 2.0, language: "tl" },
  {
    word: "sobrang galing",
    sentiment: "positive",
    weight: 2.0,
    language: "tl",
    isPhrase: true,
  },
  { word: "saya", sentiment: "positive", weight: 1.2, language: "tl" },
  {
    word: "nakaka-inspire",
    sentiment: "positive",
    weight: 1.8,
    language: "tl",
  },
  { word: "tumpak", sentiment: "positive", weight: 1.5, language: "tl" },
  { word: "malinis", sentiment: "positive", weight: 1.2, language: "tl" },

  // --- NEGATIVE ENGLISH ---
  { word: "bad", sentiment: "negative", weight: 1.0, language: "en" },
  { word: "terrible", sentiment: "negative", weight: 2.0, language: "en" },
  { word: "awful", sentiment: "negative", weight: 2.0, language: "en" },
  { word: "horrible", sentiment: "negative", weight: 2.0, language: "en" },
  { word: "hate", sentiment: "negative", weight: 2.0, language: "en" },
  { word: "worst", sentiment: "negative", weight: 2.5, language: "en" },
  { word: "disappointed", sentiment: "negative", weight: 1.5, language: "en" },
  { word: "boring", sentiment: "negative", weight: 1.5, language: "en" },
  { word: "disorganized", sentiment: "negative", weight: 1.8, language: "en" },
  { word: "waste", sentiment: "negative", weight: 2.0, language: "en" },
  { word: "late", sentiment: "negative", weight: 1.2, language: "en" },
  { word: "unclear", sentiment: "negative", weight: 1.2, language: "en" },
  { word: "difficult", sentiment: "negative", weight: 1.2, language: "en" },
  { word: "confusing", sentiment: "negative", weight: 1.5, language: "en" },
  { word: "poor", sentiment: "negative", weight: 1.5, language: "en" },
  { word: "dislike", sentiment: "negative", weight: 1.5, language: "en" },
  { word: "frustrated", sentiment: "negative", weight: 1.8, language: "en" },
  { word: "unprepared", sentiment: "negative", weight: 1.8, language: "en" },
  { word: "crowded", sentiment: "negative", weight: 1.2, language: "en" },
  { word: "chaotic", sentiment: "negative", weight: 2.0, language: "en" },
  { word: "messy", sentiment: "negative", weight: 1.5, language: "en" },
  { word: "problem", sentiment: "negative", weight: 1.2, language: "en" },
  { word: "issue", sentiment: "negative", weight: 1.2, language: "en" },
  { word: "failed", sentiment: "negative", weight: 2.0, language: "en" },
  { word: "failure", sentiment: "negative", weight: 2.0, language: "en" },
  { word: "weak", sentiment: "negative", weight: 1.2, language: "en" },
  { word: "slow", sentiment: "negative", weight: 1.2, language: "en" },
  { word: "expensive", sentiment: "negative", weight: 1.2, language: "en" },
  { word: "useless", sentiment: "negative", weight: 2.0, language: "en" },
  { word: "annoying", sentiment: "negative", weight: 1.8, language: "en" },

  // --- NEGATIVE TAGALOG ---
  { word: "masama", sentiment: "negative", weight: 1.2, language: "tl" },
  { word: "pangit", sentiment: "negative", weight: 1.5, language: "tl" },
  { word: "nakakainis", sentiment: "negative", weight: 1.8, language: "tl" },
  { word: "galit", sentiment: "negative", weight: 1.8, language: "tl" },
  {
    word: "walang kwenta",
    sentiment: "negative",
    weight: 2.0,
    language: "tl",
    isPhrase: true,
  },
  { word: "sayang", sentiment: "negative", weight: 1.5, language: "tl" },
  {
    word: "hindi maganda",
    sentiment: "negative",
    weight: 1.5,
    language: "tl",
    isPhrase: true,
  },
  { word: "magulo", sentiment: "negative", weight: 1.5, language: "tl" },
  { word: "nahirapan", sentiment: "negative", weight: 1.2, language: "tl" },
  { word: "nakakadismaya", sentiment: "negative", weight: 1.8, language: "tl" },
  { word: "dismayado", sentiment: "negative", weight: 1.8, language: "tl" },
  { word: "nakakaasar", sentiment: "negative", weight: 1.8, language: "tl" },
  { word: "badtrip", sentiment: "negative", weight: 1.8, language: "tl" },
  { word: "kulang", sentiment: "negative", weight: 1.2, language: "tl" },
  { word: "mali", sentiment: "negative", weight: 1.2, language: "tl" },
  { word: "mabagal", sentiment: "negative", weight: 1.2, language: "tl" },
  { word: "panget", sentiment: "negative", weight: 1.5, language: "tl" },
  { word: "bulok", sentiment: "negative", weight: 2.0, language: "tl" },
  { word: "nakaka-antok", sentiment: "negative", weight: 1.5, language: "tl" },
  {
    word: "hindi maayos",
    sentiment: "negative",
    weight: 1.5,
    language: "tl",
    isPhrase: true,
  },
  { word: "abala", sentiment: "negative", weight: 1.2, language: "tl" },
  { word: "pahirap", sentiment: "negative", weight: 1.8, language: "tl" },
  { word: "gulo", sentiment: "negative", weight: 1.2, language: "tl" },

  // --- NEUTRAL ENGLISH ---
  { word: "okay", sentiment: "neutral", weight: 1.0, language: "en" },
  { word: "fine", sentiment: "neutral", weight: 1.0, language: "en" },
  { word: "alright", sentiment: "neutral", weight: 1.0, language: "en" },
  { word: "normal", sentiment: "neutral", weight: 1.0, language: "en" },
  { word: "average", sentiment: "neutral", weight: 1.0, language: "en" },
  { word: "decent", sentiment: "neutral", weight: 1.0, language: "en" },
  { word: "acceptable", sentiment: "neutral", weight: 1.0, language: "en" },
  { word: "fair", sentiment: "neutral", weight: 1.0, language: "en" },
  { word: "standard", sentiment: "neutral", weight: 1.0, language: "en" },

  // --- NEUTRAL TAGALOG ---
  {
    word: "okay lang",
    sentiment: "neutral",
    weight: 1.0,
    language: "tl",
    isPhrase: true,
  },
  {
    word: "ayos lang",
    sentiment: "neutral",
    weight: 1.0,
    language: "tl",
    isPhrase: true,
  },
  {
    word: "pwede na",
    sentiment: "neutral",
    weight: 1.0,
    language: "tl",
    isPhrase: true,
  },
  {
    word: "sakto lang",
    sentiment: "neutral",
    weight: 1.0,
    language: "tl",
    isPhrase: true,
  },
  { word: "katamtaman", sentiment: "neutral", weight: 1.0, language: "tl" },
  { word: "sapat", sentiment: "neutral", weight: 1.0, language: "tl" },
  { word: "karaniwan", sentiment: "neutral", weight: 1.0, language: "tl" },
];

async function seedLexicon() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected Successfully.");

    console.log(`Starting seeding of ${expandedLexicon.length} words...`);

    let addedCount = 0;
    let skippedCount = 0;

    for (const item of expandedLexicon) {
      const existing = await Lexicon.findOne({ word: item.word.toLowerCase() });
      if (!existing) {
        await Lexicon.create(item);
        addedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log("Seeding completed.");
    console.log(`Added: ${addedCount}`);
    console.log(`Skipped (already exist): ${skippedCount}`);

    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
}

seedLexicon();
