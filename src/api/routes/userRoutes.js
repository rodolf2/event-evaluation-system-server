const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const { requireRole } = require('../../middlewares/auth');

// All user management routes require mis role only
router.use(requireRole(['mis']));

// Get all users - restricted to mis role
router.get('/', async (req, res) => {
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

// Create new user - restricted to mis role
router.post('/', async (req, res) => {
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

    // Validate role against allowed values
    const allowedRoles = ['participant', 'psas', 'club-officer', 'school-admin', 'mis'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
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

// Update user - restricted to mis role
router.put('/:id', async (req, res) => {
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

    // Validate role if being updated
    if (role) {
      const allowedRoles = ['participant', 'psas', 'club-officer', 'school-admin', 'mis'];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role specified'
        });
      }
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