const express = require('express');
const router = express.Router();
const { bootstrapAdmin, checkBootstrapStatus } = require('../controllers/bootstrapController');
const { requireRole } = require('../../middlewares/auth');

// GET /api/bootstrap/status - Check if bootstrap is needed (public access)
router.get('/status', checkBootstrapStatus);

// POST /api/bootstrap/admin - Create first admin user (protected)
router.post('/admin', requireRole(['mis']), bootstrapAdmin);

module.exports = router;