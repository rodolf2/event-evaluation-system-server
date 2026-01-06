const mongoose = require("mongoose");

const SystemSettingsSchema = new mongoose.Schema(
  {
    // Singleton identifier - only one document should exist
    key: {
      type: String,
      default: "system_settings",
      unique: true,
      required: true,
    },
    // General system settings
    generalSettings: {
      systemName: {
        type: String,
        default: "EventStream Evaluation System",
      },
      institutionName: {
        type: String,
        default: "La Verdad Christian College - Apalit",
      },
      defaultLanguage: {
        type: String,
        enum: ["english", "filipino", "spanish"],
        default: "english",
      },
      timezone: {
        type: String,
        default: "Asia/Manila",
      },
      dateFormat: {
        type: String,
        enum: ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"],
        default: "MM/DD/YYYY",
      },
      maintenanceMode: {
        type: Boolean,
        default: false,
      },
      maintenanceMessage: {
        type: String,
        default: "System under maintenance. Please try again later.",
      },
      maxUploadSize: {
        type: Number,
        default: 10,
        min: 1,
        max: 100,
      },
      sessionTimeout: {
        type: Number,
        default: 30,
        min: 5,
        max: 120,
      },
      enableAnalytics: {
        type: Boolean,
        default: true,
      },
      showTutorials: {
        type: Boolean,
        default: true,
      },
      anonymousEvaluation: {
        type: Boolean,
        default: true,
      },
    },
    // NLP Settings
    nlpSettings: {
      autoTraining: {
        type: Boolean,
        default: true,
      },
      dictionaryVersion: {
        type: String,
        default: "v1.0.0",
      },
      lastUpdated: {
        type: Date,
        default: Date.now,
      },
      updatedBy: {
        type: String,
        default: "System",
      },
    },
    // Security settings
    securitySettings: {
      jwtExpiration: {
        type: String,
        enum: ["1h", "6h", "1d", "7d", "30d"],
        default: "7d",
      },
      passwordMinLength: {
        type: Number,
        default: 8,
        min: 6,
        max: 20,
      },
      passwordRequireSpecial: {
        type: Boolean,
        default: true,
      },
      passwordRequireNumber: {
        type: Boolean,
        default: true,
      },
      passwordRequireUppercase: {
        type: Boolean,
        default: true,
      },
      maxFailedAttempts: {
        type: Number,
        default: 5,
        min: 3,
        max: 10,
      },
      accountLockoutDuration: {
        type: Number,
        default: 15,
        min: 5,
        max: 60,
      },
      twoFactorEnabled: {
        type: Boolean,
        default: false,
      },
      ipRestrictionEnabled: {
        type: Boolean,
        default: false,
      },
      allowedIps: {
        type: String,
        default: "",
      },
      // Enhanced Security Fields
      emergencyLockdown: {
        type: Boolean,
        default: false,
      },
      ipWhitelist: [
        {
          ip: String,
          label: String,
        },
      ],
      domainWhitelist: [
        {
          domain: String,
          label: String,
        },
      ],
      sessionConcurrency: {
        type: String,
        enum: ["single", "multiple"],
        default: "single",
      },
      apiRateLimit: {
        type: Number,
        default: 100,
        min: 10,
        max: 1000,
      },
      corsAllowedOrigins: {
        type: String,
        default: "http://localhost:5173,https://eventstream.lvcc.edu.ph",
      },
    },
    // Guest account settings
    guestSettings: {
      defaultExpirationDays: {
        type: Number,
        default: 30,
        min: 1,
        max: 365,
      },
      allowGuestEvaluators: {
        type: Boolean,
        default: true,
      },
      allowGuestSpeakers: {
        type: Boolean,
        default: true,
      },
    },
    // Email settings
    emailSettings: {
      fromName: {
        type: String,
        default: "Event Evaluation System",
      },
      fromEmail: {
        type: String,
        default: null, // Uses EMAIL_USER env var if null
      },
    },
    // Updated by
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Get settings (creates default if doesn't exist)
SystemSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne({ key: "system_settings" });
  if (!settings) {
    settings = await this.create({ key: "system_settings" });
  }
  return settings;
};

// Update settings
SystemSettingsSchema.statics.updateSettings = async function (updates, userId) {
  const settings = await this.getSettings();

  if (updates.generalSettings) {
    Object.assign(settings.generalSettings, updates.generalSettings);
  }
  if (updates.securitySettings) {
    Object.assign(settings.securitySettings, updates.securitySettings);
  }
  if (updates.guestSettings) {
    Object.assign(settings.guestSettings, updates.guestSettings);
  }
  if (updates.emailSettings) {
    Object.assign(settings.emailSettings, updates.emailSettings);
  }
  if (updates.nlpSettings) {
    Object.assign(settings.nlpSettings, updates.nlpSettings);
  }

  settings.lastUpdatedBy = userId;
  await settings.save();
  return settings;
};

module.exports = mongoose.model("SystemSettings", SystemSettingsSchema);
