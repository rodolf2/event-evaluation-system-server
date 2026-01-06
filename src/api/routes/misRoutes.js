const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const Event = require("../../models/Event");
const Activity = require("../../models/Activity");
const { requireRole } = require("../../middlewares/auth");

// Import controllers
const {
  getAuditLogs,
  getAuditLogStats,
  exportAuditLogs,
  getFilterOptions,
} = require("../controllers/auditLogController");
const {
  getUserStatistics,
  getTopActiveUsers,
} = require("../controllers/userStatsController");
const {
  getSystemHealth,
  getQuickHealthCheck,
} = require("../controllers/systemHealthController");
const {
  getActiveSessions,
  revokeSession,
} = require("../controllers/securityController");

// All MIS routes require mis role
// All MIS routes require mis, superadmin, or admin role
router.use(requireRole(["mis", "superadmin", "admin"]));

// ============================================
// DASHBOARD STATS
// ============================================
router.get("/stats", async (req, res) => {
  try {
    // Get user statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });

    // Get event statistics
    const totalEvents = await Event.countDocuments();

    // Get recent activity (last 10 activities)
    const recentActivity = await Activity.find()
      .sort({ timestamp: -1 })
      .limit(10)
      .populate("user", "name email")
      .lean();

    // Format activity data
    const formattedActivity = recentActivity.map((activity) => ({
      user: activity.user?.name || "System",
      type: activity.type,
      description: activity.description,
      timestamp: activity.timestamp,
    }));

    // Determine system health based on recent errors
    let systemHealth = "Good";
    const recentErrors = await Activity.countDocuments({
      type: "error",
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    if (recentErrors > 5) {
      systemHealth = "Critical";
    } else if (recentErrors > 2) {
      systemHealth = "Warning";
    }

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        totalEvents,
        systemHealth,
        recentActivity: formattedActivity,
      },
    });
  } catch (error) {
    console.error("Error fetching MIS stats:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ============================================
// AUDIT LOGS
// ============================================
router.get("/audit-logs", getAuditLogs);
router.get("/audit-logs/stats", getAuditLogStats);
router.get("/audit-logs/export", exportAuditLogs);
router.get("/audit-logs/filter-options", getFilterOptions);

// ============================================
// USER STATISTICS
// ============================================
router.get("/user-statistics", getUserStatistics);
router.get("/user-statistics/top-active", getTopActiveUsers);

// ============================================
// SYSTEM HEALTH
// ============================================
router.get("/system-health", getSystemHealth);
router.get("/system-health", getSystemHealth);
router.get("/system-health/quick", getQuickHealthCheck);

// ============================================
// SECURITY OVERSIGHT
// ============================================
router.get("/security/sessions", getActiveSessions);
router.post("/security/sessions/:userId/revoke", revokeSession);

module.exports = router;
