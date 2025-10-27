const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  title: {
    type: String,
<<<<<<< HEAD
<<<<<<< HEAD
    required: true
  },
  description: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
=======
=======
>>>>>>> 303a0d8ce9b6f1af57b834bf2917b83323f8f842
    required: [true, 'Reminder title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  date: {
    type: Date,
    required: [true, 'Reminder date is required']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  completed: {
    type: Boolean,
    default: false
  },
  emailSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: {
    type: Date
<<<<<<< HEAD
>>>>>>> 28c2a0829cabd02254f53bf8130711435d5404e4
=======
>>>>>>> 303a0d8ce9b6f1af57b834bf2917b83323f8f842
  }
}, {
  timestamps: true
});

<<<<<<< HEAD
<<<<<<< HEAD
module.exports = mongoose.model('Reminder', reminderSchema);
=======
=======
>>>>>>> 303a0d8ce9b6f1af57b834bf2917b83323f8f842
// Index for efficient queries
reminderSchema.index({ userId: 1, date: 1 });
reminderSchema.index({ userId: 1, completed: 1 });

<<<<<<< HEAD
module.exports = mongoose.model('Reminder', reminderSchema);
>>>>>>> 28c2a0829cabd02254f53bf8130711435d5404e4
=======
module.exports = mongoose.model('Reminder', reminderSchema);
>>>>>>> 303a0d8ce9b6f1af57b834bf2917b83323f8f842
