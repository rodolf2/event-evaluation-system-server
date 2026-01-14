const User = require("../../models/User");
const GuestToken = require("../../models/GuestToken");
const AuditLog = require("../../models/AuditLog");

/**
 * Get active guest sessions (guests who accessed in the last 24 hours)
 */
const getActiveSessions = async (req, res) => {
  try {
    // Define "Active" as accessed within the last 24 hours
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const now = new Date();

    const activeGuests = await GuestToken.find({
      accessedAt: { $gte: last24Hours },
      revoked: false,
      expiresAt: { $gt: now }, // Token must not be expired
    })
      .select("name email accessedAt expiresAt reportId")
      .populate("reportId", "title")
      .sort({ accessedAt: -1 })
      .limit(50); // Limit to 50 for performance

    const sessions = activeGuests.map((guest) => ({
      id: guest._id,
      userName: guest.name,
      role: "Guest Evaluator",
      email: guest.email,
      lastAccess: guest.accessedAt,
      formTitle: guest.reportId?.title || "Unknown Form",
      status: "Active",
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
 * Revoke a guest's session
 */
const revokeSession = async (req, res) => {
  try {
    const { userId } = req.params; // This is now the GuestToken ID

    const guestToken = await GuestToken.findById(userId);
    if (!guestToken) {
      return res.status(404).json({
        success: false,
        message: "Guest session not found",
      });
    }

    // Revoke the guest token
    await guestToken.revokeToken(req.user._id);

    // Log the action
    await AuditLog.logEvent({
      userId: req.user._id,
      userEmail: req.user.email,
      userName: req.user.name,
      action: "GUEST_SESSION_REVOKED",
      category: "security",
      description: `Revoked guest session for ${guestToken.email}`,
      severity: "warning",
      metadata: {
        targetId: guestToken._id,
        targetType: "GuestToken",
        guestEmail: guestToken.email,
        guestName: guestToken.name,
      },
    });

    res.json({
      success: true,
      message: "Guest session revoked successfully",
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
