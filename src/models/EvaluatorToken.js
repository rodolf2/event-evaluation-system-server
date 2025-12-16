const mongoose = require("mongoose");
const crypto = require("crypto");

const EvaluatorTokenSchema = new mongoose.Schema(
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
    formId: {
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
    completed: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    responseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Response",
    },
  },
  {
    timestamps: true,
  }
);

// Generate a secure random token
EvaluatorTokenSchema.statics.generateToken = function () {
  return crypto.randomBytes(32).toString("hex");
};

// Check if token is valid (not expired, not revoked, not completed)
EvaluatorTokenSchema.methods.isValid = function () {
  if (this.revoked) return false;
  if (new Date() > this.expiresAt) return false;
  return true;
};

// Check if evaluation can still be submitted
EvaluatorTokenSchema.methods.canSubmit = function () {
  if (!this.isValid()) return false;
  if (this.completed) return false;
  return true;
};

// Record access
EvaluatorTokenSchema.methods.recordAccess = async function () {
  if (!this.accessedAt) {
    this.accessedAt = new Date();
  }
  this.accessCount += 1;
  await this.save();
};

// Mark as completed
EvaluatorTokenSchema.methods.markCompleted = async function (responseId) {
  this.completed = true;
  this.completedAt = new Date();
  this.responseId = responseId;
  await this.save();
};

// Revoke token
EvaluatorTokenSchema.methods.revokeToken = async function (userId) {
  this.revoked = true;
  this.revokedAt = new Date();
  this.revokedBy = userId;
  await this.save();
};

module.exports = mongoose.model("EvaluatorToken", EvaluatorTokenSchema);
