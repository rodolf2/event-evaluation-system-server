const mongoose = require("mongoose");
const os = require("os");
const Activity = require("../../models/Activity");
const AuditLog = require("../../models/AuditLog");
const User = require("../../models/User");
const Form = require("../../models/Form");

/**
 * Get comprehensive system health metrics
 */
const getSystemHealth = async (req, res) => {
  try {
    const startTime = Date.now();
    const now = new Date();
    const last24Hours = new Date(now - 24 * 60 * 60 * 1000);
    const lastHour = new Date(now - 60 * 60 * 1000);

    // Database connection status
    const dbStatus =
      mongoose.connection.readyState === 1 ? "connected" : "disconnected";

    // Database latency test
    let dbLatency = null;
    try {
      const dbStart = Date.now();
      await mongoose.connection.db.admin().ping();
      dbLatency = Date.now() - dbStart;
    } catch (err) {
      dbLatency = -1; // Indicates error
    }

    // Memory usage
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // CPU info
    const cpus = os.cpus();
    const cpuCount = cpus.length;
    const loadAverage = os.loadavg(); // [1min, 5min, 15min]

    // Server uptime
    const serverUptime = process.uptime();

    // Error counts from Activity model
    const [
      errorsLast24h,
      errorsLastHour,
      warningsLast24h,
      totalActivitiesLast24h,
    ] = await Promise.all([
      Activity.countDocuments({
        type: "error",
        createdAt: { $gte: last24Hours },
      }),
      Activity.countDocuments({
        type: "error",
        createdAt: { $gte: lastHour },
      }),
      Activity.countDocuments({
        type: "warning",
        createdAt: { $gte: last24Hours },
      }),
      Activity.countDocuments({
        createdAt: { $gte: last24Hours },
      }),
    ]);

    // Calculate error rate
    const errorRate =
      totalActivitiesLast24h > 0
        ? ((errorsLast24h / totalActivitiesLast24h) * 100).toFixed(2)
        : 0;

    // Database statistics
    let dbStats = {};
    try {
      dbStats = await mongoose.connection.db.stats();
    } catch (err) {
      console.error("Failed to get DB stats:", err);
    }

    // Collection counts
    const [userCount, formCount, auditLogCount] = await Promise.all([
      User.countDocuments(),
      Form.countDocuments(),
      AuditLog.countDocuments(),
    ]);

    // Recent critical events
    const recentCriticalEvents = await AuditLog.find({
      severity: "critical",
      createdAt: { $gte: last24Hours },
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Recent errors from Activity
    const recentErrors = await Activity.find({
      type: "error",
      createdAt: { $gte: last24Hours },
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("userId", "name email")
      .lean();

    // Calculate overall health status
    let overallHealth = "healthy";
    let healthScore = 100;

    if (dbStatus !== "connected") {
      overallHealth = "critical";
      healthScore -= 50;
    }
    if (dbLatency > 1000) {
      overallHealth = "degraded";
      healthScore -= 20;
    }
    if (errorsLastHour > 10) {
      overallHealth = "degraded";
      healthScore -= 15;
    }
    if (parseFloat(errorRate) > 5) {
      overallHealth = "warning";
      healthScore -= 10;
    }
    if (memoryUsage.heapUsed / memoryUsage.heapTotal > 0.9) {
      overallHealth = "warning";
      healthScore -= 10;
    }

    if (healthScore < 50) overallHealth = "critical";
    else if (healthScore < 70) overallHealth = "degraded";
    else if (healthScore < 90) overallHealth = "warning";
    else overallHealth = "healthy";

    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        overview: {
          status: overallHealth,
          healthScore: Math.max(0, healthScore),
          lastChecked: new Date().toISOString(),
          responseTime: `${responseTime}ms`,
        },
        database: {
          status: dbStatus,
          latency: dbLatency !== -1 ? `${dbLatency}ms` : "error",
          collections: {
            users: userCount,
            forms: formCount,
            auditLogs: auditLogCount,
          },
          storageSize: dbStats.storageSize
            ? `${(dbStats.storageSize / 1024 / 1024).toFixed(2)} MB`
            : "N/A",
          dataSize: dbStats.dataSize
            ? `${(dbStats.dataSize / 1024 / 1024).toFixed(2)} MB`
            : "N/A",
        },
        memory: {
          heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
          heapUsedPercent: (
            (memoryUsage.heapUsed / memoryUsage.heapTotal) *
            100
          ).toFixed(1),
          rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
          external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`,
          systemTotal: `${(totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
          systemFree: `${(freeMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
          systemUsedPercent: ((usedMemory / totalMemory) * 100).toFixed(1),
        },
        cpu: {
          cores: cpuCount,
          model: cpus[0]?.model || "Unknown",
          loadAverage: {
            "1min": loadAverage[0]?.toFixed(2) || "N/A",
            "5min": loadAverage[1]?.toFixed(2) || "N/A",
            "15min": loadAverage[2]?.toFixed(2) || "N/A",
          },
        },
        server: {
          uptime: formatUptime(serverUptime),
          uptimeSeconds: serverUptime,
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          pid: process.pid,
        },
        errors: {
          last24Hours: errorsLast24h,
          lastHour: errorsLastHour,
          warningsLast24h,
          errorRate: `${errorRate}%`,
          recentErrors: recentErrors.map((err) => ({
            id: err._id,
            action: err.action,
            description: err.description,
            timestamp: err.createdAt,
            user: err.userId?.name || "System",
          })),
        },
        criticalEvents: recentCriticalEvents.map((event) => ({
          id: event._id,
          action: event.action,
          description: event.description,
          timestamp: event.createdAt,
          category: event.category,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching system health:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch system health",
      error: error.message,
    });
  }
};

/**
 * Format uptime to human readable string
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
}

/**
 * Get quick health check (lightweight)
 */
const getQuickHealthCheck = async (req, res) => {
  try {
    const dbConnected = mongoose.connection.readyState === 1;

    res.json({
      success: true,
      data: {
        status: dbConnected ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
        database: dbConnected ? "connected" : "disconnected",
        uptime: formatUptime(process.uptime()),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: "error",
      message: error.message,
    });
  }
};

module.exports = {
  getSystemHealth,
  getQuickHealthCheck,
};
