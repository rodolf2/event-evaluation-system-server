const express = require('express');
const router = express.Router();
const { bootstrapAdmin, checkBootstrapStatus } = require('../controllers/bootstrapController');
const { requireRole } = require('../../middlewares/auth');

// All bootstrap routes require admin access
router.use(requireRole(['mis']));

// GET /api/bootstrap/status - Check if bootstrap is needed
router.get('/status', checkBootstrapStatus);

// POST /api/bootstrap/admin - Create first admin user
router.post('/admin', bootstrapAdmin);

module.exports = router;