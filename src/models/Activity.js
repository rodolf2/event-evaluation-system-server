const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: [true, 'Activity action is required'],
    trim: true,
    maxlength: [100, 'Action cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Activity description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  type: {
    type: String,
    enum: ['form', 'evaluation', 'report', 'profile', 'system', 'notification', 'reminder'],
    default: 'system'
  },
  metadata: {
    // Additional data related to the activity
    formId: mongoose.Schema.Types.ObjectId,
    evaluationId: mongoose.Schema.Types.ObjectId,
    reportId: mongoose.Schema.Types.ObjectId,
    targetUserId: mongoose.Schema.Types.ObjectId,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  }
}, {
  timestamps: true
});

// Index for efficient queries
activitySchema.index({ userId: 1, createdAt: -1 });
activitySchema.index({ type: 1, createdAt: -1 });

// Virtual for user info
activitySchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('Activity', activitySchema);
