const Reminder = require('../../models/Reminder');
const User = require('../../models/User');
const sendEmail = require('../../utils/email');

// @desc    Get all reminders for the logged-in user
// @route   GET /api/reminders
// @access  Private
const getReminders = async (req, res) => {
  try {
    const reminders = await Reminder.find({ user: req.user.id });
    res.json(reminders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a new reminder
// @route   POST /api/reminders
// @access  Private
const createReminder = async (req, res) => {
  const { title, description, date } = req.body;

  try {
    const reminder = new Reminder({
      title,
      description,
      date,
      user: req.user.id
    });

    const createdReminder = await reminder.save();
    res.status(201).json(createdReminder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete a reminder
// @route   DELETE /api/reminders/:id
// @access  Private
const deleteReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findById(req.params.id);

    if (!reminder) {
      return res.status(404).json({ message: 'Reminder not found' });
    }

    // Check if the reminder belongs to the user
    if (reminder.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await Reminder.deleteOne({ _id: req.params.id });

    const user = await User.findById(req.user.id);

    await sendEmail({
      email: user.email,
      subject: 'Reminder Deleted',
      message: `Your reminder "${reminder.title}" has been deleted.`
    });

    res.json({ message: 'Reminder removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getReminders,
  createReminder,
  deleteReminder
};