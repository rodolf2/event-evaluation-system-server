const mongoose = require("mongoose");

const responseSchema = new mongoose.Schema({
  responses: [
    {
      questionId: {
        type: String,
        required: true,
      },
      questionTitle: {
        type: String,
        required: true,
      },
      answer: {
        type: mongoose.Schema.Types.Mixed, // Can be string, array, etc.
        required: true,
      },
    },
  ],
  respondentEmail: {
    type: String,
    trim: true,
  },
  respondentName: {
    type: String,
    trim: true,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
});

const questionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    required: true,
    enum: [
      "short_answer",
      "paragraph",
      "multiple_choice",
      "scale",
      "date",
      "time",
      "file_upload",
    ],
  },
  required: {
    type: Boolean,
    default: false,
  },
  options: [
    {
      type: String,
      trim: true,
    },
  ],
  low: {
    type: Number,
    default: 1,
  },
  high: {
    type: Number,
    default: 5,
  },
  lowLabel: {
    type: String,
    default: "Poor",
  },
  highLabel: {
    type: String,
    default: "Excellent",
  },
  sectionId: {
    type: mongoose.Schema.Types.Mixed, // Can be "main" or section id for association
    default: "main",
  },
  icon: {
    type: String,
    enum: ["star", "emoji", "heart", "Default", "Star", "Heart"],
    default: null,
  },
});

const formSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    googleFormId: {
      type: String,
      index: true,
    },
    // Optional: structured section metadata for multi-section forms (PSAS builder)
    sections: [
      {
        id: {
          type: mongoose.Schema.Types.Mixed,
        },
        title: {
          type: String,
          trim: true,
        },
        description: {
          type: String,
          trim: true,
        },
        sectionNumber: {
          type: Number,
        },
      },
    ],
    questions: [questionSchema],
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    shareableLink: {
      type: String,
      trim: true,
    },
    publishedAt: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    responses: [responseSchema],
    responseCount: {
      type: Number,
      default: 0,
    },
    uploadedFiles: [
      {
        filename: String,
        originalName: String,
        size: Number,
        path: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    attendeeList: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null, // Can be null if user is not registered
        },
        name: {
          type: String,
          trim: true,
        },
        email: {
          type: String,
          trim: true,
          lowercase: true,
        },
        hasResponded: {
          type: Boolean,
          default: false,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
        certificateGenerated: {
          type: Boolean,
          default: false,
        },
        certificateId: {
          type: String,
          default: null,
        },
      },
    ],
    uploadedLinks: [
      {
        title: String,
        url: String,
        description: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    clientQuestions: [
      {
        type: mongoose.Schema.Types.Mixed, // Store client-side question format
      },
    ],
    eventStartDate: {
      type: Date,
      default: null,
    },
    eventEndDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
formSchema.index({ createdBy: 1, status: 1 });
formSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model("Form", formSchema);
