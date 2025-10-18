const express = require('express');
const router = express.Router();
const {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserStats,
  bulkUpdateUsers
} = require('../controllers/userController');
const { requireRole } = require('../../middlewares/auth');

// All user management routes require admin access
router.use(requireRole(['mis', 'psas']));

// POST /api/users - Create new user (admin only)
router.post('/', createUser);

// GET /api/users - Get all users with pagination and filters
router.get('/', getAllUsers);

// GET /api/users/stats/overview - Get user statistics for admin dashboard
router.get('/stats/overview', getUserStats);

// GET /api/users/:id - Get user by ID
router.get('/:id', getUserById);

// PUT /api/users/:id - Update user
router.put('/:id', updateUser);

// DELETE /api/users/:id - Delete/deactivate user
router.delete('/:id', deleteUser);

// PUT /api/users/bulk - Bulk update users
router.put('/bulk', bulkUpdateUsers);

module.exports = router;