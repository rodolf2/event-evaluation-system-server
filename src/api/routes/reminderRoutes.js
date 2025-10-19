const express = require('express');
const router = express.Router();
const { protect } = require('../../middleware/authMiddleware');
const reminderService = require('../../services/reminder/reminderService');
const Reminder = require('../../models/Reminder');

// GET /api/reminders - Get all reminders for the authenticated user
router.get('/', protect, async (req, res) => {
  try {
    const reminders = await Reminder.find({ userId: req.user._id })
      .sort({ date: 1, createdAt: -1 });

    res.status(200).json(reminders);
  } catch (error) {
    console.error('Error fetching reminders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reminders',
      error: error.message,
    });
  }
});

// POST /api/reminders - Create a new reminder
router.post('/', protect, async (req, res) => {
  try {
    const { title, date, description, priority } = req.body;

    if (!title || !date) {
      return res.status(400).json({
        success: false,
        message: 'Title and date are required',
      });
    }

    const reminderData = {
      title,
      date: new Date(date),
      description: description || '',
      priority: priority || 'medium',
      userId: req.user._id,
    };

    const newReminder = await reminderService.createReminder(reminderData);

    res.status(201).json({
      success: true,
      message: 'Reminder created successfully and email sent',
      data: newReminder,
    });
  } catch (error) {
    console.error('Error creating reminder:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create reminder',
      error: error.message,
    });
  }
});

// DELETE /api/reminders/:id - Delete a reminder
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;

    const reminder = await Reminder.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found',
      });
    }

    await Reminder.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Reminder deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting reminder:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete reminder',
      error: error.message,
    });
  }
});

module.exports = router;