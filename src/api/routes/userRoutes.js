const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const { protect, authorize } = require('../../middleware/authMiddleware');

// Get all users - restricted to admin and mis roles
router.get('/', protect, authorize('school-admin', 'mis'), async (req, res) => {
  try {
    const users = await User.find().select('-__v');
    
    res.json({
      success: true,
      data: {
        users
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Create new user - restricted to admin and mis roles
router.post('/', protect, authorize('school-admin', 'mis'), async (req, res) => {
  try {
    const { name, email, role } = req.body;
    
    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }
    
    // Create user
    const user = await User.create({
      name,
      email,
      role,
      isActive: true
    });
    
    res.status(201).json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update user - restricted to admin and mis roles
router.put('/:id', protect, authorize('school-admin', 'mis'), async (req, res) => {
  try {
    const { name, email, role, isActive } = req.body;
    
    // Find user
    let user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Update user
    user.name = name || user.name;
    user.email = email || user.email;
    user.role = role || user.role;
    user.isActive = isActive !== undefined ? isActive : user.isActive;
    
    await user.save();
    
    res.json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;