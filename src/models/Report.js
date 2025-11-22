const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    formId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Form",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    eventDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "published", "active"],
      default: "published",
    },
    isGenerated: {
      type: Boolean,
      default: false,
    },
    feedbackCount: {
      type: Number,
      default: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
    },
    thumbnail: {
      type: String,
      default: "/thumbnails/default-report.png",
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      description: String,
      attendeeCount: Number,
      responseRate: Number,
      eventStartDate: Date,
      eventEndDate: Date,
      department: String,
      category: String,
    },
    analytics: {
      sentimentBreakdown: {
        positive: { count: Number, percentage: Number },
        neutral: { count: Number, percentage: Number },
        negative: { count: Number, percentage: Number },
      },
      quantitativeData: {
        totalResponses: Number,
        totalAttendees: Number,
        responseRate: Number,
        averageRating: Number,
      },
      charts: {
        yearData: [{ name: String, value: Number }],
        ratingDistribution: [{ name: String, value: Number }],
        statusBreakdown: [{ name: String, value: Number }],
        responseTrends: [{ date: String, count: Number }],
      },
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
reportSchema.index({ formId: 1, userId: 1 });
reportSchema.index({ userId: 1, lastUpdated: -1 });
reportSchema.index({ status: 1 });
reportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-deletion

// Pre-save middleware to update lastUpdated
reportSchema.pre("save", function (next) {
  this.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model("Report", reportSchema);
