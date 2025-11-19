const mongoose = require('mongoose');

const CertificateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
  },
  formId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Form',
  },
  certificateType: {
    type: String,
    enum: ['participation', 'completion', 'achievement'],
    default: 'participation',
  },
  issuedDate: {
    type: Date,
    default: Date.now,
  },
  certificateId: {
    type: String,
    unique: true,
    required: true,
  },
  filePath: {
    type: String,
    required: true,
  },
  isEmailSent: {
    type: Boolean,
    default: false,
  },
  emailSentDate: {
    type: Date,
  },
  emailDeliveryFailed: {
    type: Boolean,
    default: false,
  },
  emailRetryCount: {
    type: Number,
    default: 0,
  },
  emailLastAttempt: {
    type: Date,
  },
  emailNextRetry: {
    type: Date,
  },
  emailError: {
    type: String,
  },
  emailFinalError: {
    type: String,
  },
  customMessage: {
    type: String,
    maxlength: 500,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
  // Track which form submission this certificate was generated for
  respondentEmail: {
    type: String,
  },
  respondentName: {
    type: String,
  },
  templateId: {
    type: String,
  },
});

module.exports = mongoose.model('Certificate', CertificateSchema);