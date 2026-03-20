const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const { requireRole } = require("../../middlewares/auth");
const AuditLog = require("../../models/AuditLog");
const { updateUser, getAllUsers, createUser, provisionUser, bulkUpdateUsers, bulkUpdateStatus } = require("../controllers/userController");
const { getStudentManagementStats, getUserManagementStats } = require("../controllers/userStatsController");

// Get student management stats - allow MIS and PSAS
router.get("/stats/student-management", requireRole(["mis", "psas"]), getStudentManagementStats);

// Get user management stats - allow MIS only
router.get("/stats/user-management", requireRole(["mis"]), getUserManagementStats);

// Get all users - allow MIS and PSAS
router.get("/", requireRole(["mis", "psas"]), getAllUsers);

// Bulk update user status - restricted to mis (all) and psas (ITSS Coordinator only)
router.put("/bulk-status", requireRole(["mis", "psas"]), bulkUpdateStatus);

// Create new user - restricted to mis role
router.post("/", requireRole(["mis"]), createUser);

// Provision user with permissions - restricted to mis (all) and psas (ITSS Coordinator only)
router.post("/provision", requireRole(["mis", "psas"]), provisionUser);

// Bulk update user permissions - restricted to mis role
router.put("/bulk-permissions", requireRole(["mis"]), async (req, res) => {
  try {
    const { users } = req.body;

    if (!users || !Array.isArray(users) || users.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Users array is required",
      });
    }

    const updateResults = [];

    for (const userData of users) {
      const { userId, permissions } = userData;

      if (!userId || !permissions) {
        continue;
      }

      const user = await User.findById(userId);
      if (!user) {
        continue;
      }

      // Update permissions
      user.permissions = {
        ...Object.fromEntries(user.permissions || new Map()),
        ...permissions,
      };

      await user.save();
      updateResults.push({
        userId,
        success: true,
      });

      // Log the permission change
      await AuditLog.logEvent({
        userId: req.user._id,
        userEmail: req.user.email,
        userName: req.user.name,
        action: "PERMISSION_CHANGE",
        category: "user",
        description: `Updated permissions for ${user.email}`,
        severity: "info",
        metadata: {
          targetId: user._id,
          targetType: "User",
          permissions: permissions,
        },
      });
    }

    res.json({
      success: true,
      message: `Updated permissions for ${updateResults.length} users`,
      data: {
        updated: updateResults.length,
      },
    });
  } catch (error) {
    console.error("Error updating bulk permissions:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Update user - restricted to mis and psas roles (controller handles specific permissions)
router.put("/:id", requireRole(["mis", "psas"]), updateUser);

module.exports = router;
