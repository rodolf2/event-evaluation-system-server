const express = require('express');
const router = express.Router();
const { requireRole } = require('../../middlewares/auth');
const Event = require('../../models/Event');
const Feedback = require('../../models/Feedback');
const analysisService = require('../../services/analysis/analysisService');
const csv = require('csv-parser');
const fs = require('fs');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

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
// @access  Protected (psas, school-admin, mis)
router.get('/:id/feedback', requireRole(['psas', 'school-admin', 'mis']), async (req, res) => {
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
// @access  Protected (psas, school-admin, mis)
router.get('/:id/analytics', requireRole(['psas', 'school-admin', 'mis']), async (req, res) => {
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

// @route   GET /api/events/:id/report
// @desc    Get report data for a specific event
// @access  Protected (psas, school-admin, mis)
router.get('/:id/report', requireRole(['psas', 'school-admin', 'mis']), async (req, res) => {
  try {
    const eventId = req.params.id;

    // Get event details
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get feedback count and basic stats
    const feedbackCount = await Feedback.countDocuments({ eventId });
    const feedbacks = await Feedback.find({ eventId });
    const ratings = feedbacks.map(fb => fb.rating).filter(r => r != null && r > 0);
    const averageRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

    // Generate qualitative and quantitative reports
    const qualitativeReport = await analysisService.generateQualitativeReport(eventId);
    const quantitativeReport = await analysisService.generateQuantitativeReport(eventId);

    const reportData = {
      id: event._id,
      title: `${event.name} Evaluation Report`,
      eventName: event.name,
      eventDate: event.date,
      thumbnail: '/Reports.png', // Using the Reports.png image from public folder
      feedbackCount,
      averageRating,
      qualitativeReport,
      quantitativeReport,
      generatedAt: new Date()
    };

    res.json(reportData);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/events/reports
// @desc    Get all available reports for events that have feedback
// @access  Protected (psas, school-admin, mis)
router.get('/reports/all', requireRole(['psas', 'school-admin', 'mis']), async (req, res) => {
  try {
    console.log('Fetching all reports...');
    console.log('User role:', req.user ? req.user.role : 'No user');

    // Find events that have feedback
    const eventsWithFeedback = await Feedback.distinct('eventId');
    console.log('Events with feedback:', eventsWithFeedback.length);

    // Get event details for these events
    const events = await Event.find({ _id: { $in: eventsWithFeedback } }).sort({ date: -1 });
    console.log('Found events:', events.length);

    const reports = await Promise.all(events.map(async (event) => {
      const feedbackCount = await Feedback.countDocuments({ eventId: event._id });

      return {
        id: event._id,
        title: `${event.name} Evaluation Report`,
        thumbnail: '/Reports.png',
        eventName: event.name,
        eventDate: event.date,
        feedbackCount
      };
    }));

    console.log('Generated reports:', reports.length);
    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/events/:id/attendees
// @desc    Upload attendee CSV for an event
// @access  Protected (psas, club-officer)
router.post('/:id/attendees', requireRole(['psas', 'club-officer']), upload.single('attendees'), async (req, res) => {
  try {
    const eventId = req.params.id;
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const attendees = [];
    const filePath = req.file.path;

    // Parse CSV
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        if (row.name && row.email) {
          attendees.push({
            name: row.name.trim(),
            email: row.email.trim().toLowerCase()
          });
        }
      })
      .on('end', async () => {
        // Remove duplicates
        const uniqueAttendees = attendees.filter((attendee, index, self) =>
          index === self.findIndex(a => a.email === attendee.email)
        );

        event.attendees = uniqueAttendees;
        await event.save();

        // Clean up uploaded file
        fs.unlinkSync(filePath);

        res.json({
          success: true,
          message: `Uploaded ${uniqueAttendees.length} attendees`,
          attendees: uniqueAttendees
        });
      })
      .on('error', (error) => {
        console.error('CSV parsing error:', error);
        res.status(500).json({ error: 'Error parsing CSV file' });
      });
  } catch (error) {
    console.error('Error uploading attendees:', error);
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/events
// @desc    Create a new event
// @access  Protected (psas, club-officer)
router.post('/', requireRole(['psas', 'club-officer']), async (req, res) => {
  try {
    const { name, date, category, description, verificationCode } = req.body;

    const event = new Event({
      name,
      date,
      category,
      description,
      verificationCode
    });

    await event.save();
    res.status(201).json(event);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Verification code already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;