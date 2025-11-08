const express = require('express');
const router = express.Router();
const Certificate = require('../../models/Certificate');
const CertificateController = require('../controllers/certificateController');
const { requireAuth } = require('../../middlewares/auth');

// GET /api/certificates/form/:formId - Get certificates for a specific form
router.get('/form/:formId', requireAuth, CertificateController.getCertificate.bind(CertificateController));

// GET /api/certificates/my - Get current user's certificates
router.get('/my', requireAuth, async (req, res) => {
  try {
    const { userId } = req.user;
    const certificates = await Certificate.find({ userId })
      .populate('eventId', 'name date')
      .populate('formId', 'title')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: certificates,
    });
  } catch (error) {
    console.error('Error fetching user certificates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch certificates',
      error: error.message,
    });
  }
});

// GET /api/certificates/download/:certificateId - Download certificate PDF
router.get('/download/:certificateId', requireAuth, CertificateController.downloadCertificate.bind(CertificateController));

// POST /api/certificates/generate - Generate certificate
router.post('/generate', requireAuth, CertificateController.generateCertificate.bind(CertificateController));

// POST /api/certificates/generate-bulk - Generate bulk certificates
router.post('/generate-bulk', requireAuth, CertificateController.generateBulkCertificates.bind(CertificateController));

// GET /api/certificates/:certificateId - Get a specific certificate
router.get('/:certificateId', requireAuth, CertificateController.getCertificate.bind(CertificateController));

// PUT /api/certificates/:certificateId - Update a certificate
router.put('/:certificateId', requireAuth, CertificateController.updateCertificate.bind(CertificateController));

// DELETE /api/certificates/:certificateId - Delete a certificate
router.delete('/:certificateId', requireAuth, CertificateController.deleteCertificate.bind(CertificateController));

// GET /api/certificates/user/:userId - Get user certificates
router.get('/user/:userId', requireAuth, CertificateController.getUserCertificates.bind(CertificateController));

// GET /api/certificates/event/:eventId - Get event certificates
router.get('/event/:eventId', requireAuth, CertificateController.getEventCertificates.bind(CertificateController));

// POST /api/certificates/:certificateId/resend - Resend certificate
router.post('/:certificateId/resend', requireAuth, CertificateController.resendCertificate.bind(CertificateController));

// GET /api/certificates/stats - Get certificate statistics
router.get('/stats', requireAuth, CertificateController.getCertificateStats.bind(CertificateController));

// GET /api/certificates/templates - Get available certificate templates
router.get('/templates', requireAuth, async (req, res) => {
  try {
    // For now, return static templates - in a real app, these would be from a database
    const templates = [
      {
        id: 'classic-blue',
        name: 'Classic Blue',
        preview: '/templates/classic-blue.json'
      },
      {
        id: 'elegant-gold',
        name: 'Elegant Gold',
        preview: '/templates/elegant-gold.json'
      },
      {
        id: 'modern-red',
        name: 'Modern Red',
        preview: '/templates/modern-red.json'
      },
      {
        id: 'professional-green',
        name: 'Professional Green',
        preview: '/templates/professional-green.json'
      },
      {
        id: 'simple-black',
        name: 'Simple Black',
        preview: '/templates/simple-black.json'
      },
      {
        id: 'vintage-purple',
        name: 'Vintage Purple',
        preview: '/templates/vintage-purple.json'
      }
    ];

    res.status(200).json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error('Error fetching certificate templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch certificate templates',
      error: error.message,
    });
  }
});

module.exports = router;