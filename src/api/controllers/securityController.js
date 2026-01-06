const User = require("../../models/User");
const AuditLog = require("../../models/AuditLog");

/**
 * Get active sessions (users active in the last 24 hours)
 */
const getActiveSessions = async (req, res) => {
  try {
    // Define "Active" as logged in within the last 24 hours
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const activeUsers = await User.find({
      lastLogin: { $gte: last24Hours },
      isActive: true, // Only show enabled accounts
    })
      .select("name role lastLogin email")
      .sort({ lastLogin: -1 })
      .limit(50); // Limit to 50 for performance

    const sessions = activeUsers.map((user) => ({
      id: user._id,
      userName: user.name,
      role: user.role,
      email: user.email,
      lastAccess: user.lastLogin,
      status: "Active", // Since we filtered by last 24h
    }));

    res.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    console.error("Error fetching active sessions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch active sessions",
    });
  }
};

/**
 * Revoke a user's session
 */
const revokeSession = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Increment token version to invalidate existing tokens
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    // Log the action
    await AuditLog.logEvent({
      userId: req.user._id,
      userEmail: req.user.email,
      userName: req.user.name,
      action: "SESSION_REVOKED",
      category: "security",
      description: `Revoked session for user ${user.email}`,
      severity: "warning",
      metadata: {
        targetId: user._id,
        targetType: "User",
      },
    });

    res.json({
      success: true,
      message: "Session revoked successfully",
    });
  } catch (error) {
    console.error("Error revoking session:", error);
    res.status(500).json({
      success: false,
      message: "Failed to revoke session",
    });
  }
};

module.exports = {
  getActiveSessions,
  revokeSession,
};
