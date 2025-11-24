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
          type: Number,
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
          required: true,
        },
        position: {
          type: String,
          required: true,
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
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
sharedReportSchema.index({ reportId: 1, sharedWith: 1 });
sharedReportSchema.index({ "sharedWith.email": 1 });

const SharedReport = mongoose.model("SharedReport", sharedReportSchema);

module.exports = SharedReport;
