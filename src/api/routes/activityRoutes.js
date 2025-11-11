const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../../middlewares/auth');
const {
  getUserActivities,
  getRoleActivities,
  getSystemActivities,
  logActivity
} = require('../controllers/activityController');

// All authenticated users can get their own activities
router.get('/', requireAuth, getUserActivities);

// School Admins and MIS can get activities for specific roles
router.get('/role/:role', requireAuth, requireRole(['school-admin', 'mis']), getRoleActivities);

// School Admins and MIS can get system-wide activities
router.get('/system', requireAuth, requireRole(['school-admin', 'mis']), getSystemActivities);

// All authenticated users can log their activities
router.post('/log', requireAuth, logActivity);

module.exports = router;
