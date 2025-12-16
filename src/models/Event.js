const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    category: {
      type: String,
      default: "general",
    },
    description: {
      type: String,
      default: "",
    },
    attendees: [
      {
        name: {
          type: String,
          required: true,
        },
        email: {
          type: String,
          required: true,
        },
      },
    ],
    verificationCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    // Guest evaluator account expiration (in days)
    guestExpirationDays: {
      type: Number,
      default: null, // null means use system default
      min: 1,
      max: 365,
    },
  },
  {
    timestamps: true,
  }
);

// Index for finding events by name and year (for analysis)
eventSchema.index({ name: 1, date: 1 });

module.exports = mongoose.model("Event", eventSchema);
