const express = require('express');
const router = express.Router();
const googleFormsController = require('../controllers/googleFormsController');

/**
 * @route   POST /api/google-forms/extract
 * @desc    Extract questions and sections from a Google Form URL
 * @access  Public
 * @body    { formUrl: string }
 * @returns { success: boolean, data: { title, description, sections, questions, totalQuestions } }
 */
router.post('/extract', googleFormsController.extractFormQuestions);

/**
 * @route   POST /api/google-forms/validate
 * @desc    Validate a Google Form URL
 * @access  Public
 * @body    { formUrl: string }
 * @returns { success: boolean, isValid: boolean, originalUrl: string, viewformUrl: string }
 */
router.post('/validate', googleFormsController.validateFormUrl);

/**
 * @route   POST /api/google-forms/extract-and-save
 * @desc    Extract form questions and associate with an event
 * @access  Public
 * @body    { formUrl: string, eventId: string }
 * @returns { success: boolean, data: { eventId, eventName, formUrl, extractedData } }
 */
router.post('/extract-and-save', googleFormsController.extractAndSaveToEvent);

/**
 * @route   POST /api/google-forms/extract-batch
 * @desc    Extract questions from multiple Google Forms
 * @access  Public
 * @body    { formUrls: string[] }
 * @returns { success: boolean, summary: object, results: array, errors: array }
 */
router.post('/extract-batch', googleFormsController.extractBatchForms);

/**
 * @route   GET /api/google-forms/samples
 * @desc    Get sample Google Form URLs for testing
 * @access  Public
 * @returns { success: boolean, data: array }
 */
router.get('/samples', googleFormsController.getSampleForms);

module.exports = router;