const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  (req, res) => {
    // Generate JWT token with role information and profile picture
    const token = jwt.sign(
      { 
        id: req.user._id, 
        email: req.user.email,
        role: req.user.role,
        isActive: req.user.isActive,
        profilePicture: req.user.profilePicture
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Redirect to client with token
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
  }
);

// Get current user profile
router.get('/profile', async (req, res) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    // Return user data with role information and profile picture
    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          profilePicture: user.profilePicture
        },
      },
    });
  } catch (error) {
    console.error('Error in profile route:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token',
    });
  }
});

module.exports = router;