const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const { requireRole } = require("../../middlewares/auth");
const AuditLog = require("../../models/AuditLog");

// All user management routes require mis role only
router.use(requireRole(["mis"]));

// Get all users - restricted to mis role
router.get("/", async (req, res) => {
  try {
    const users = await User.find().select("-__v");

    res.json({
      success: true,
      data: {
        users,
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Create new user - restricted to mis role
router.post("/", async (req, res) => {
  try {
    const { name, email, role } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Validate role against allowed values
    const allowedRoles = [
      "student",
      "psas",
      "club-officer",
      "senior-management",
      "mis",
    ];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role specified",
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      role,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Provision user with permissions - restricted to mis role
router.post("/provision", async (req, res) => {
  try {
    const { email, role, permissions, name } = req.body;

    if (!email || !role) {
      return res.status(400).json({
        success: false,
        message: "Email and role are required",
      });
    }

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Validate role against allowed values
    const allowedRoles = [
      "student",
      "psas",
      "club-officer",
      "senior-management",
      "mis",
    ];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role specified",
      });
    }

    // Determine name: use provided name or parse from email
    let finalName = name;
    if (!finalName) {
      const parsedName = email.split("@")[0].replace(/[._]/g, " ");
      finalName = parsedName
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }

    const user = await User.create({
      name: finalName,
      email,
      role,
      permissions: permissions || {},
      isActive: true,
    });

    res.status(201).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    console.error("Error provisioning user:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Bulk update user permissions - restricted to mis role
// NOTE: This route must be defined BEFORE /:id to prevent 'bulk-permissions' being matched as an ID
router.put("/bulk-permissions", async (req, res) => {
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

// Update user - restricted to mis role
router.put("/:id", async (req, res) => {
  try {
    const { name, email, role, isActive } = req.body;

    // Find user
    let user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Validate role if being updated
    if (role) {
      const allowedRoles = [
        "student",
        "psas",
        "club-officer",
        "senior-management",
        "mis",
      ];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role specified",
        });
      }
    }

    // Capture old values for logging
    const oldRole = user.role;
    const oldStatus = user.isActive;

    // Update user fields
    user.name = name || user.name;
    user.email = email || user.email;
    user.role = role || user.role;
    // Handle boolean explicitly
    if (isActive !== undefined) user.isActive = isActive;

    // PSCO Elevation fields
    if (req.body.program !== undefined) user.program = req.body.program;
    if (req.body.elevationDate !== undefined)
      user.elevationDate = req.body.elevationDate;

    await user.save();

    // AUDIT LOGGING
    // Log Role Change
    if (role && role !== oldRole) {
      await AuditLog.logEvent({
        userId: req.user._id,
        userEmail: req.user.email,
        userName: req.user.name,
        action: "ROLE_CHANGE",
        category: "user",
        description: `Changed role of ${user.email} from ${oldRole} to ${role}`,
        severity: "warning",
        metadata: {
          targetId: user._id,
          targetType: "User",
          oldValue: oldRole,
          newValue: role,
        },
      });
    }

    // Log Status Change (Suspend/Activate)
    if (isActive !== undefined && isActive !== oldStatus) {
      await AuditLog.logEvent({
        userId: req.user._id,
        userEmail: req.user.email,
        userName: req.user.name,
        action: isActive ? "USER_ACTIVATED" : "USER_SUSPENDED",
        category: "user",
        description: `${isActive ? "Activated" : "Suspended"} user ${
          user.email
        }`,
        severity: "warning",
        metadata: {
          targetId: user._id,
          targetType: "User",
          oldValue: oldStatus,
          newValue: isActive,
        },
      });
    }

    res.json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;
