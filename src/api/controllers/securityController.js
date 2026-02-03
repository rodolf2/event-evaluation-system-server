const User = require("../../models/User");
const GuestToken = require("../../models/GuestToken");
const EvaluatorToken = require("../../models/EvaluatorToken");
const AuditLog = require("../../models/AuditLog");

/**
 * Get active guest sessions (guests who accessed in the last 24 hours)
 */
const getActiveSessions = async (req, res) => {
  try {
    const now = new Date();

    // Fetch Guest Speakers (Report Viewers)
    const activeSpeakers = await GuestToken.find({
      revoked: false,
      expiresAt: { $gt: now },
    })
      .select("name email accessedAt expiresAt reportId createdAt")
      .populate("reportId", "title")
      .sort({ accessedAt: -1, createdAt: -1 })
      .limit(50);

    // Fetch Guest Evaluators (Survey Participants)
    const activeEvaluators = await EvaluatorToken.find({
      revoked: false,
      expiresAt: { $gt: now },
    })
      .select("name email accessedAt expiresAt formId createdAt")
      .populate("formId", "title")
      .sort({ accessedAt: -1, createdAt: -1 })
      .limit(50);

    // Map Speakers
    const speakerSessions = activeSpeakers.map((guest) => ({
      id: guest._id,
      userName: guest.name,
      role: "Guest Speaker",
      email: guest.email,
      lastAccess: guest.accessedAt,
      expiresAt: guest.expiresAt,
      formTitle: guest.reportId?.title || "Unknown Form",
      status: "Active",
      type: "speaker"
    }));

    // Map Evaluators
    const evaluatorSessions = activeEvaluators.map((guest) => ({
      id: guest._id,
      userName: guest.name,
      role: "Guest Evaluator",
      email: guest.email,
      lastAccess: guest.accessedAt,
      expiresAt: guest.expiresAt,
      formTitle: guest.formId?.title || "Unknown Form",
      status: "Active",
      type: "evaluator"
    }));

    // Merge and Sort by last access
    const combinedSessions = [...speakerSessions, ...evaluatorSessions].sort(
      (a, b) => new Date(b.lastAccess) - new Date(a.lastAccess)
    );

    res.json({
      success: true,
      data: combinedSessions,
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
 * Revoke a guest's session (Speaker or Evaluator)
 */
const revokeSession = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check GuestToken collection first
    let guestToken = await GuestToken.findById(userId);
    let tokenType = "Guest Speaker";

    // If not found, check EvaluatorToken collection
    if (!guestToken) {
      guestToken = await EvaluatorToken.findById(userId);
      tokenType = "Guest Evaluator";
    }

    if (!guestToken) {
      return res.status(404).json({
        success: false,
        message: "Guest session not found",
      });
    }

    // Revoke the token
    await guestToken.revokeToken(req.user._id);

    // Log the action
    await AuditLog.logEvent({
      userId: req.user._id,
      userEmail: req.user.email,
      userName: req.user.name,
      action: "GUEST_SESSION_REVOKED",
      category: "security",
      description: `Revoked ${tokenType} session for ${guestToken.email}`,
      severity: "warning",
      metadata: {
        targetId: guestToken._id,
        targetType: tokenType === "Guest Speaker" ? "GuestToken" : "EvaluatorToken",
        guestEmail: guestToken.email,
        guestName: guestToken.name,
        role: tokenType
      },
    });

    res.json({
      success: true,
      message: `${tokenType} session revoked successfully`,
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
