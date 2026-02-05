const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const Event = require("../../models/Event");
const AuditLog = require("../../models/AuditLog");
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
// All MIS routes require mis, superadmin, admin, or psas role (specifically for PSAS Head security controls)
router.use(requireRole(["mis", "superadmin", "admin", "psas"]));

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

    // Get recent activity (last 10 logs) from AuditLog
    const recentLogs = await AuditLog.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Format activity data
    const formattedActivity = recentLogs.map((log) => ({
      user: log.userName || log.userEmail || "System",
      type: log.action,
      description: log.description,
      timestamp: log.createdAt,
    }));

    // Determine system health based on recent errors (critical severity logs)
    let systemHealth = "Good";
    const recentErrors = await AuditLog.countDocuments({
      severity: "critical",
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
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
// RECENT ACTIVITY (New Endpoint)
// ============================================
router.get("/recent-activity", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // Fetch recent logs
    const recentLogs = await AuditLog.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Format for frontend
    const activities = recentLogs.map((log) => ({
      _id: log._id,
      user: log.userName || log.userEmail || "System",
      action: log.action,
      description: log.description,
      createdAt: log.createdAt,
      severity: log.severity,
    }));

    res.json({
      success: true,
      data: activities,
    });
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching recent activity",
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
