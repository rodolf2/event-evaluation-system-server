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
  customMessage: {
    type: String,
    maxlength: 500,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
});

module.exports = mongoose.model('Certificate', CertificateSchema);