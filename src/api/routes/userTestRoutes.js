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

// Test-friendly routes without authentication for development
// These routes are only available in development mode

// POST /api/test/users - Create new user (no auth required for testing)
router.post('/', createUser);

// GET /api/test/users - Get all users with pagination and filters (no auth required for testing)
router.get('/', getAllUsers);

// GET /api/test/users/stats/overview - Get user statistics (no auth required for testing)
router.get('/stats/overview', getUserStats);

// GET /api/test/users/:id - Get user by ID (no auth required for testing)
router.get('/:id', getUserById);

// PUT /api/test/users/:id - Update user (no auth required for testing)
router.put('/:id', updateUser);

// DELETE /api/test/users/:id - Delete/deactivate user (no auth required for testing)
router.delete('/:id', deleteUser);

// PUT /api/test/users/bulk - Bulk update users (no auth required for testing)
router.put('/bulk', bulkUpdateUsers);

module.exports = router;
