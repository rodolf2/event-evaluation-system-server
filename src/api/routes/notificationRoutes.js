const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../../middlewares/auth');
const {
  getUserNotifications,
  createNotification,
  markAsRead,
  markMultipleAsRead,
  deleteNotification,
  deleteMultiple,
  getNotificationStats
} = require('../controllers/notificationController');

// All authenticated users can get their notifications
router.get('/', requireAuth, getUserNotifications);

// All authenticated users can get notification stats
router.get('/stats', requireAuth, getNotificationStats);

// PSAS, Club Officers, School Admins, MIS can create notifications
router.post('/', requireAuth, requireRole(['psas', 'club-officer', 'school-admin', 'mis']), createNotification);

// All authenticated users can mark notifications as read
router.put('/:id/read', requireAuth, markAsRead);

// All authenticated users can mark multiple notifications as read
router.put('/read-multiple', requireAuth, markMultipleAsRead);

// All authenticated users can delete their own notifications
router.delete('/:id', requireAuth, deleteNotification);

// All authenticated users can delete their own notifications
router.delete('/multiple', requireAuth, deleteMultiple);

module.exports = router;
