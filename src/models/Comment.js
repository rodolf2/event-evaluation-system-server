const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  formId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Form',
    required: true,
  },
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
  },
  questionTitle: String,
  answer: String,
  respondentEmail: String,
  respondentName: String,
  submittedAt: Date,
  sentiment: {
    type: String,
    enum: ['positive', 'neutral', 'negative', 'error'],
    default: 'neutral',
  },
  analyzedAt: Date,
  analysisConfidence: Number,
  cached: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

commentSchema.index({ formId: 1, analyzedAt: -1 });
commentSchema.index({ formId: 1, sentiment: 1 });
commentSchema.index({ formId: 1, analyzedAt: 1, sentiment: 1 });

module.exports = mongoose.model('Comment', commentSchema);