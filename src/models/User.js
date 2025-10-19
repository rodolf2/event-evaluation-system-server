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
    sparse: true,
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

module.exports = mongoose.model('User', UserSchema);
