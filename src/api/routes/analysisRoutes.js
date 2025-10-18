const express = require('express');
const router = express.Router();
const analysisController = require('../controllers/analysisController');
const { requireRole } = require('../../middlewares/auth');

// All analysis routes require admin or student access
router.use(requireRole(['psas', 'school-admin', 'mis']));

// @route   GET /api/analysis/event/:eventId/average-rating
// @desc    Get the average rating for a specific event
// @access  Private (admin, student)
router.get('/event/:eventId/average-rating', analysisController.getAverageRatingForEvent);

// @route   GET /api/analysis/event/:eventId/qualitative-report
// @desc    Get a qualitative report for a specific event
// @access  Private (admin, student)
router.get('/event/:eventId/qualitative-report', analysisController.getQualitativeReportForEvent);

// @route   GET /api/analysis/event/:eventId/quantitative-report
// @desc    Get a quantitative report for a specific event
// @access  Private (admin, student)
router.get('/event/:eventId/quantitative-report', analysisController.getQuantitativeReportForEvent);

module.exports = router;
