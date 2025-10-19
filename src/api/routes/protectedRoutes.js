const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/authMiddleware');

// Route accessible to all authenticated users
router.get('/user', protect, (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'You have access to user resources',
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role
      }
    }
  });
});

// Route accessible only to school-admin and mis roles
router.get('/admin', protect, authorize('school-admin', 'mis'), (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'You have access to admin resources',
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role
      }
    }
  });
});

// Route accessible only to mis role
router.get('/mis', protect, authorize('mis'), (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'You have access to MIS resources',
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role
      }
    }
  });
});

module.exports = router;