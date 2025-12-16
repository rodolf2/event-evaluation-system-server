const mongoose = require("mongoose");
const crypto = require("crypto");

const GuestTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Form",
      required: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    expirationDays: {
      type: Number,
      default: 7,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    accessedAt: {
      type: Date,
      default: null,
    },
    accessCount: {
      type: Number,
      default: 0,
    },
    revoked: {
      type: Boolean,
      default: false,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
    emailSentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Generate a secure random token
GuestTokenSchema.statics.generateToken = function () {
  return crypto.randomBytes(32).toString("hex");
};

// Check if token is valid (not expired and not revoked)
GuestTokenSchema.methods.isValid = function () {
  if (this.revoked) return false;
  if (new Date() > this.expiresAt) return false;
  return true;
};

// Record access
GuestTokenSchema.methods.recordAccess = async function () {
  if (!this.accessedAt) {
    this.accessedAt = new Date();
  }
  this.accessCount += 1;
  await this.save();
};

// Revoke token
GuestTokenSchema.methods.revokeToken = async function (userId) {
  this.revoked = true;
  this.revokedAt = new Date();
  this.revokedBy = userId;
  await this.save();
};

module.exports = mongoose.model("GuestToken", GuestTokenSchema);
