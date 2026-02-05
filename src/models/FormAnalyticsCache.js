const mongoose = require("mongoose");

/**
 * FormAnalyticsCache Model
 * 
 * Stores pre-computed analytics data for forms to improve performance.
 * This cache is updated by background jobs and serves data to analytics endpoints.
 */

const formAnalyticsCacheSchema = new mongoose.Schema(
  {
    formId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Form",
      required: true,
      unique: true,
      index: true,
    },
    lastAnalyzedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    totalResponses: {
      type: Number,
      default: 0,
    },
    totalAttendees: {
      type: Number,
      default: 0,
    },
    responseRate: {
      type: Number,
      default: 0,
    },
    remainingNonResponses: {
      type: Number,
      default: 0,
    },
    // Pre-computed sentiment breakdown
    sentimentBreakdown: {
      positive: {
        count: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
      },
      neutral: {
        count: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
      },
      negative: {
        count: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
      },
    },
    // Categorized comments with sentiment analysis
    categorizedComments: {
      positive: [
        {
          text: String,
          confidence: Number,
          _id: false,
        },
      ],
      neutral: [
        {
          text: String,
          confidence: Number,
          _id: false,
        },
      ],
      negative: [
        {
          text: String,
          confidence: Number,
          _id: false,
        },
      ],
    },
    // Pre-computed question breakdown
    questionBreakdown: [
      {
        questionId: String,
        questionTitle: String,
        questionType: String,
        responseCount: Number,
        responses: mongoose.Schema.Types.Mixed,
        sentimentBreakdown: mongoose.Schema.Types.Mixed,
        _id: false,
      },
    ],
    // Response overview time series
    responseOverview: {
      labels: [String],
      data: [Number],
      dateRange: String,
    },
    // Analysis metadata
    analysisMethod: {
      type: String,
      enum: ["python", "javascript", "fallback"],
      default: "python",
    },
    processingTime: {
      type: Number, // milliseconds
      default: 0,
    },
    // Track which responses were analyzed
    analyzedResponseCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
formAnalyticsCacheSchema.index({ formId: 1, lastAnalyzedAt: -1 });


/**
 * Check if cache is stale (older than threshold)
 * @param {Number} maxAgeMinutes - Maximum age in minutes (default: 60)
 * @returns {Boolean}
 */
formAnalyticsCacheSchema.methods.isStale = function (maxAgeMinutes = 60) {
  const now = new Date();
  const ageMs = now - this.lastAnalyzedAt;
  const ageMinutes = ageMs / (1000 * 60);
  return ageMinutes > maxAgeMinutes;
};

/**
 * Get cache age in minutes
 * @returns {Number}
 */
formAnalyticsCacheSchema.methods.getAgeMinutes = function () {
  const now = new Date();
  const ageMs = now - this.lastAnalyzedAt;
  return Math.round(ageMs / (1000 * 60));
};

module.exports = mongoose.model("FormAnalyticsCache", formAnalyticsCacheSchema);
