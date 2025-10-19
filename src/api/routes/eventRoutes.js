const express = require('express');
const router = express.Router();
const Event = require('../../models/Event');
const Feedback = require('../../models/Feedback');

// @route   GET /api/events
// @desc    Get all events
// @access  Public
router.get('/', async (req, res) => {
  try {
    const events = await Event.find({}).sort({ date: -1 });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/events/:id
// @desc    Get event by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/events/:id/feedback
// @desc    Get all feedback for a specific event
// @access  Public
router.get('/:id/feedback', async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ eventId: req.params.id })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });
    res.json(feedbacks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/events/:id/analytics
// @desc    Get analytics for a specific event
// @access  Public
router.get('/:id/analytics', async (req, res) => {
  try {
    // NOTE: This is a mock implementation.
    // In a real app, you would calculate this data based on the event ID.
    const analyticsData = {
      totalAttendees: 506,
      totalResponses: 200,
      responseRate: 40,
      responseBreakdown: {
        positive: { count: 100, percentage: 50 },
        neutral: { count: 70, percentage: 35 },
        negative: { count: 30, percentage: 15 },
      },
      responseOverview: {
        labels: ["8/14", "8/15", "8/16", "8/17", "8/18", "8/19"],
        data: [10, 50, 100, 10, 15, 15],
        dateRange: "August 14, 2025 - August 19, 2025",
      },
    };
    res.json(analyticsData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;