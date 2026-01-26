const mongoose = require("mongoose");

const LexiconSchema = new mongoose.Schema(
  {
    word: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    sentiment: {
      type: String,
      enum: ["positive", "negative", "neutral"],
      required: true,
    },
    weight: {
      type: Number,
      default: 1.0,
      min: 0,
      max: 5,
    },
    language: {
      type: String,
      enum: ["en", "tl"],
      default: "en",
    },
    isPhrase: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster searching by language and sentiment
LexiconSchema.index({ language: 1, sentiment: 1 });

module.exports = mongoose.model("Lexicon", LexiconSchema);
