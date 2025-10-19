const mongoose = require('mongoose');

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
  },
  avatar: {
    type: String, // URL to profile picture from Google
  },
  role: {
    type: String,
    enum: ['psas', 'club-officer', 'participant', 'school-admin', 'mis'],
    default: 'participant',
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
    default: null
  },
  role: {
    type: String,
    enum: ['participant', 'psas', 'club-officer', 'school-admin', 'mis'],
    default: 'participant',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

// Update the updatedAt field before saving
UserSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to update last login
UserSchema.methods.updateLastLogin = function() {
  this.lastLogin = Date.now();
  return this.save();
};

// Static method to get user type from email
UserSchema.statics.getUserTypeFromEmail = function(email) {
  const emailPrefix = email.split('@')[0];
  if (emailPrefix.includes('psas')) {
    return 'psas';
  } else if (emailPrefix.includes('club-officer')) {
    return 'club-officer';
  } else if (emailPrefix.includes('school-admin')) {
    return 'school-admin';
  } else if (emailPrefix.includes('mis')) {
    return 'mis';
  }
  return 'participant';
};

module.exports = mongoose.model('User', UserSchema);
