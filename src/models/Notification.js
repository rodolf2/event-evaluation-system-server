const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Notification message is required'],
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  type: {
    type: String,
    enum: ['info', 'warning', 'success', 'error', 'reminder'],
    default: 'info'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  // Target roles for this notification
  targetRoles: [{
    type: String,
    enum: ['participant', 'psas', 'club-officer', 'school-admin', 'mis'],
    required: true
  }],
  // Specific users (optional, if not provided, send to all users with target roles)
  targetUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Related entity (form, event, etc.)
  relatedEntity: {
    type: {
      type: String,
      enum: ['form', 'event', 'certificate', 'reminder', 'system']
    },
    id: mongoose.Schema.Types.ObjectId
  },
  // Auto-delete after this date
  expiresAt: {
    type: Date
  },
  // Notification metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isSystemGenerated: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for efficient queries
notificationSchema.index({ targetRoles: 1, createdAt: -1 });
notificationSchema.index({ targetUsers: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for user read status
notificationSchema.virtual('userReads', {
  ref: 'NotificationRead',
  localField: '_id',
  foreignField: 'notificationId'
});

module.exports = mongoose.model('Notification', notificationSchema);
