const mongoose = require('mongoose');

const notificationReadSchema = new mongoose.Schema({
  notificationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Notification',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  readAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to ensure one read record per user-notification pair
notificationReadSchema.index({ notificationId: 1, userId: 1 }, { unique: true });

// Index for efficient queries
notificationReadSchema.index({ userId: 1, readAt: -1 });

module.exports = mongoose.model('NotificationRead', notificationReadSchema);
