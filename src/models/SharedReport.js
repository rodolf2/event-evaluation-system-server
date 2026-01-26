const mongoose = require("mongoose");

const sharedReportSchema = new mongoose.Schema(
  {
    reportId: {
      type: String,
      required: true,
      index: true,
    },
    eventId: {
      type: String,
      required: true,
    },
    sharedWith: [
      {
        personnelId: {
          type: String,
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        email: {
          type: String,
          required: true,
        },
        department: {
          type: String,
        },
        position: {
          type: String,
        },
      },
    ],
    sharedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sharedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Index for efficient queries
sharedReportSchema.index({ reportId: 1, sharedWith: 1 });
sharedReportSchema.index({ "sharedWith.email": 1 });

const SharedReport = mongoose.model("SharedReport", sharedReportSchema);

module.exports = SharedReport;
