const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true, // Only enforces uniqueness for non-null values
    index: true,
  },
  avatar: {
    type: String, // URL to profile picture from Google
  },
  role: {
    type: String,
    enum: [
      "student",
      "psas",
      "club-officer",
      "senior-management",
      "club-adviser",
      "mis",
      "evaluator",
      "guest-speaker",
    ],
    default: "student",
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastLogin: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  profilePicture: {
    type: String,
    default: null,
  },
  department: {
    type: String,
    default: null,
  },
  position: {
    type: String,
    default: null,
  },
  position: {
    type: String,
    default: null,
  },
  muteNotifications: {
    type: Boolean,
    default: false,
  },
  muteReminders: {
    type: Boolean,
    default: false,
  },
  hasCompletedOnboarding: {
    type: Boolean,
    default: false,
  },
  onboardingStep: {
    type: Number,
    default: 0,
  },
  onboardingCompletedAt: {
    type: Date,
    default: null,
  },
  // Guest account fields
  isGuest: {
    type: Boolean,
    default: false,
  },
  expiresAt: {
    type: Date,
    default: null,
    index: { expires: 0 }, // MongoDB TTL index - auto-deletes when expiresAt is reached
  },
  expirationDays: {
    type: Number,
    default: null, // Store the configured expiration period
  },
  tokenVersion: {
    type: Number,
    default: 0,
  },
  // PSCO Elevation fields
  program: {
    type: String,
    default: null,
  },
  elevationDate: {
    type: Date,
    default: null,
  },
  // Role expiration for auto-demotion (e.g., club-officer -> student after 1 year)
  roleExpiresAt: {
    type: Date,
    default: null,
  },
  previousRole: {
    type: String,
    default: null,
  },
  elevatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  // Detailed Permissions (for User Management toggles)
  permissions: {
    type: Map,
    of: Boolean,
    default: {},
  },
});

// Update the updatedAt field before saving
UserSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Method to update last login
UserSchema.methods.updateLastLogin = function () {
  this.lastLogin = Date.now();
  return this.save();
};

// Static method to get user type from email
UserSchema.statics.getUserTypeFromEmail = function (email) {
  const emailPrefix = email.split("@")[0];
  if (emailPrefix.includes("psas")) {
    return "psas";
  } else if (emailPrefix.includes("club-officer")) {
    return "club-officer";
  } else if (emailPrefix.includes("senior-management")) {
    return "senior-management";
  } else if (emailPrefix.includes("club-adviser")) {
    return "club-adviser";
  } else if (emailPrefix.includes("mis")) {
    return "mis";
  }
  return "student";
};

module.exports = mongoose.model("User", UserSchema);
