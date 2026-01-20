const mongoose = require("mongoose");

const CertificateTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  canvasData: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  thumbnail: {
    type: String, // Base64 encoded image or URL
  },
  category: {
    type: String,
    default: "custom",
    trim: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  isPublic: {
    type: Boolean,
    default: false, // Only visible to creator by default
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update timestamp on save
CertificateTemplateSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Index for fast querying
CertificateTemplateSchema.index({ createdBy: 1, createdAt: -1 });
CertificateTemplateSchema.index({ isPublic: 1, createdAt: -1 });

module.exports = mongoose.model(
  "CertificateTemplate",
  CertificateTemplateSchema
);
