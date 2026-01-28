const activityService = require('../../services/activityService');

// @desc    Get recent activities for the logged-in user
// @route   GET /api/activities
// @access  Private (All authenticated users)
const getUserActivities = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // School admins don't create activities, so return empty array
    if (req.user.role === 'school-admin') {
      return res.json({
        success: true,
        data: []
      });
    }

    const activities = await activityService.getUserActivities(req.user._id, limit);

    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Error fetching user activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activities',
      error: error.message
    });
  }
};

// @desc    Get recent activities for a specific role (admin only)
// @route   GET /api/activities/role/:role
// @access  Private (School Admins, MIS only)
const getRoleActivities = async (req, res) => {
  try {
    const { role } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    // Validate role
    const validRoles = ['participant', 'psas', 'club-officer', 'club-adviser', 'school-admin', 'mis'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }

    const activities = await activityService.getRoleActivities(role, limit);

    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Error fetching role activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch role activities',
      error: error.message
    });
  }
};

// @desc    Get system-wide recent activities (admin only)
// @route   GET /api/activities/system
// @access  Private (School Admins, MIS only)
const getSystemActivities = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const activities = await activityService.getSystemActivities(limit);

    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Error fetching system activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system activities',
      error: error.message
    });
  }
};

// @desc    Log an activity (internal use)
// @route   POST /api/activities/log
// @access  Private (All authenticated users)
const logActivity = async (req, res) => {
  try {
    const { action, description, type, metadata } = req.body;

    if (!action || !description) {
      return res.status(400).json({
        success: false,
        message: 'Action and description are required'
      });
    }

    const activity = await activityService.logActivity(
      req.user._id,
      action,
      description,
      type,
      metadata,
      req
    );

    res.status(201).json({
      success: true,
      message: 'Activity logged successfully',
      data: activity
    });
  } catch (error) {
    console.error('Error logging activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log activity',
      error: error.message
    });
  }
};

module.exports = {
  getUserActivities,
  getRoleActivities,
  getSystemActivities,
  logActivity
};
