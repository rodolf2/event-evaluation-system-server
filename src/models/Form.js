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
      sectionId: {
        type: mongoose.Schema.Types.Mixed, // Can be "main" or section id for association
        default: "main",
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
      maxlength: [1000, "Title cannot exceed 1000 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [5000, "Description cannot exceed 5000 characters"],
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
      enum: ["draft", "published", "closed"],
      default: "draft",
    },
    type: {
      type: String,
      enum: ["evaluation", "notification", "config"],
      default: "evaluation", // Default to evaluation for backward compatibility
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
        yearLevel: {
          type: String,
          default: null,
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
    // Certificate template linkage
    linkedCertificateId: {
      type: String,
      default: null,
    },
    linkedCertificateType: {
      type: String,
      enum: ["participation", "completion", "achievement"],
      default: "completion",
    },
    certificateTemplateName: {
      type: String,
      default: null,
    },
    isCertificateLinked: {
      type: Boolean,
      default: false,
    },
    // Certificate customization options
    certificateCustomizations: {
      // Branding options
      organizationName: {
        type: String,
        default: "La Verdad Christian College",
        maxlength: [100, "Organization name cannot exceed 100 characters"],
      },
      organizationLogo: {
        type: String, // URL or base64 data
        default: null,
      },
      // Color scheme
      primaryColor: {
        type: String,
        default: "#0f3b66", // Default blue
        validate: {
          validator: function (v) {
            return /^#[0-9A-F]{6}$/i.test(v); // Hex color validation
          },
          message: "Primary color must be a valid hex color code",
        },
      },
      secondaryColor: {
        type: String,
        default: "#c89d28", // Default gold
        validate: {
          validator: function (v) {
            return /^#[0-9A-F]{6}$/i.test(v); // Hex color validation
          },
          message: "Secondary color must be a valid hex color code",
        },
      },
      // Custom messages
      customTitle: {
        type: String,
        default: "Certificate of Participation",
        maxlength: [100, "Custom title cannot exceed 100 characters"],
      },
      customSubtitle: {
        type: String,
        default: "This certificate is proudly presented to",
        maxlength: [200, "Custom subtitle cannot exceed 200 characters"],
      },
      customMessage: {
        type: String,
        default: null,
        maxlength: [500, "Custom message cannot exceed 500 characters"],
      },
      // Signature customization
      signature1Name: {
        type: String,
        default: "Dr. Sharene T. Labung",
        maxlength: [100, "Signature 1 name cannot exceed 100 characters"],
      },
      signature1Title: {
        type: String,
        default: "Chancellor / Administrator",
        maxlength: [100, "Signature 1 title cannot exceed 100 characters"],
      },
      signature2Name: {
        type: String,
        default: "Luckie Kristine Villanueva",
        maxlength: [100, "Signature 2 name cannot exceed 100 characters"],
      },
      signature2Title: {
        type: String,
        default: "PSAS Department Head",
        maxlength: [100, "Signature 2 title cannot exceed 100 characters"],
      },
      // Download format preferences
      defaultDownloadFormat: {
        type: String,
        enum: ["pdf", "png", "jpg"],
        default: "pdf",
      },
      // Additional participant details to include
      includeEventDate: {
        type: Boolean,
        default: true,
      },
      includeCompletionDate: {
        type: Boolean,
        default: true,
      },
      includeFormTitle: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  },
);

// Index for efficient queries
formSchema.index({ createdBy: 1, status: 1 });
formSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model("Form", formSchema);
