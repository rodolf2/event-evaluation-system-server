const reminderService = require('../../services/reminder/reminderService');
const { emitUpdate } = require("../../utils/socket");

// @desc    Get all reminders for the logged-in user
// @route   GET /api/reminders
// @access  Private
const getReminders = async (req, res) => {
  try {
    const reminders = await reminderService.getUserReminders(req.user._id);
    res.json(reminders);
  } catch (error) {
    console.error('Error fetching reminders:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a new reminder
// @route   POST /api/reminders
// @access  Private
const createReminder = async (req, res) => {
  const { title, description, date, priority } = req.body;

  try {
    const reminderData = {
      title,
      description,
      date: new Date(date),
      priority: priority || 'medium',
      userId: req.user._id
    };

    const createdReminder = await reminderService.createReminder(reminderData);
    res.status(201).json(createdReminder);

    // Emit socket event for real-time reminders
    emitUpdate("reminder-updated", { action: "created", userId: req.user._id }, req.user._id);
  } catch (error) {
    console.error('Error creating reminder:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete a reminder
// @route   DELETE /api/reminders/:id
// @access  Private
const deleteReminder = async (req, res) => {
  try {
    await reminderService.deleteReminder(req.params.id, req.user._id);
    res.json({ message: 'Reminder removed' });

    // Emit socket event for real-time reminders
    emitUpdate("reminder-updated", { action: "deleted", userId: req.user._id }, req.user._id);
  } catch (error) {
    console.error('Error deleting reminder:', error);
    if (error.message === 'Reminder not found or unauthorized') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getReminders,
  createReminder,
  deleteReminder
};
