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
});

module.exports = mongoose.model('User', UserSchema);
