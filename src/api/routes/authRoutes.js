const express = require('express');
const router = express.Router();
const passport = require('../../config/passport');
const {
  googleAuthCallback,
  googleAuthFailure,
  logout,
  getProfile,
  updateProfile,
  checkAuth,
  verifyAdmin
} = require('../controllers/authController');
const { requireAuth } = require('../../middlewares/auth');

// Google OAuth routes
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/api/auth/google/failure' }),
  googleAuthCallback
);

router.get('/google/failure', googleAuthFailure);

// Protected routes (require authentication)
router.get('/profile', requireAuth, getProfile);

router.put('/profile', requireAuth, updateProfile);

router.get('/check', requireAuth, checkAuth);

router.get('/verify-admin', requireAuth, verifyAdmin);

// Logout route
router.post('/logout', logout);

// Alternative logout route for GET requests
router.get('/logout', logout);

module.exports = router;