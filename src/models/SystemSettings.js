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

  if (updates.guestSettings) {
    Object.assign(settings.guestSettings, updates.guestSettings);
  }
  if (updates.emailSettings) {
    Object.assign(settings.emailSettings, updates.emailSettings);
  }

  settings.lastUpdatedBy = userId;
  await settings.save();
  return settings;
};

module.exports = mongoose.model("SystemSettings", SystemSettingsSchema);
