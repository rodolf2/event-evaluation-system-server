const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/certificateController');

// Generate a single certificate
router.post('/generate', certificateController.generateCertificate);

// Generate certificates for multiple participants
router.post('/generate-bulk', certificateController.generateBulkCertificates);

// Get certificate by ID
router.get('/:certificateId', certificateController.getCertificate);

// Download certificate PDF
router.get('/download/:certificateId', certificateController.downloadCertificate);

// Get certificates for a user
router.get('/user/:userId', certificateController.getUserCertificates);

// Get certificates for an event
router.get('/event/:eventId', certificateController.getEventCertificates);

// Resend certificate email
router.post('/:certificateId/resend', certificateController.resendCertificate);

// Delete certificate
router.delete('/:certificateId', certificateController.deleteCertificate);

// Get certificate statistics
router.get('/stats', certificateController.getCertificateStats);

module.exports = router;