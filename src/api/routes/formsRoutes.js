const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middlewares/auth');
const formsController = require('../controllers/formsController');

// GET /api/forms - Get all forms for the authenticated user
router.get('/', requireAuth, formsController.getAllForms);

// GET /api/forms/:id - Get a specific form by ID
router.get('/:id', requireAuth, formsController.getFormById);

// POST /api/forms/blank - Create a new blank form
router.post('/blank', requireAuth, formsController.createBlankForm);

// POST /api/forms/upload - Upload a file and create a form from it
router.post('/upload', requireAuth, formsController.uploadForm);

// POST /api/forms/extract-by-url - Extract data from Google Forms URL without creating form
router.post('/extract-by-url', requireAuth, formsController.extractFormByUrl);

// POST /api/forms/extract-by-file - Extract questions from a file without creating a form
router.post('/extract-by-file', requireAuth, formsController.extractFormByFile);

// POST /api/forms/upload-by-url - Upload a Google Forms URL and create a form from it
router.post('/upload-by-url', requireAuth, formsController.uploadFormByUrl);

// PATCH /api/forms/:id/publish - Publish a form and generate shareable link
router.patch('/:id/publish', requireAuth, formsController.publishForm);

// DELETE /api/forms/:id - Delete a form
router.delete('/:id', requireAuth, formsController.deleteForm);

// POST /api/forms/:id/submit - Submit responses to a form
router.post('/:id/submit', formsController.submitFormResponse);

// GET /api/forms/:id/responses - Get responses for a form
router.get('/:id/responses', requireAuth, formsController.getFormResponses);

module.exports = router;