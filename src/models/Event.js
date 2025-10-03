const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
});

module.exports = mongoose.model('Event', EventSchema);
