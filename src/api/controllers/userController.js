const User = require("../../models/User");
const { emitUpdate } = require("../../utils/socket");
const { generateToken } = require("../../middlewares/auth");
const AuditLog = require("../../models/AuditLog");

// Create new user
const createUser = async (req, res) => {
  console.log("👤 Creating user with data:", req.body);

  const { name, email, role, isActive } = req.body;
  let newUser;

  try {
    // Validate required fields
    if (!name || !email) {
      console.log("❌ Missing required fields");
      return res.status(400).json({
        success: false,
        message: "Name and email are required",
      });
    }

    // [SECURITY] Only MIS Head can create new users
    if (req.user.position !== "MIS Head") {
      return res.status(403).json({
        success: false,
        message: "Only the MIS Head can create new users",
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log("❌ Email already exists:", email);
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    // [VALIDATION] Enforce strict email domain for manual creation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@laverdad\.edu\.ph$/;
    if (!emailRegex.test(email)) {
         return res.status(400).json({
        success: false,
        message: "Email must be a valid @laverdad.edu.ph address",
      });
    }

    // Create new user
    newUser = new User({
      name,
      email,
      role: role || "user",
      isActive: isActive !== undefined ? isActive : true,
    });

    console.log("💾 Saving user to database...");
    const savedUser = await newUser.save();
    console.log("✅ User saved successfully:", savedUser._id);

    // Audit log for user creation
    if (req.user) {
      await AuditLog.logEvent({
        userId: req.user._id,
        userEmail: req.user.email,
        userName: req.user.name,
        action: "USER_CREATE",
        category: "user",
        description: `Created user: ${savedUser.email}`,
        severity: "info",
        metadata: {
          targetId: savedUser._id,
          targetType: "User",
          newValue: { name: savedUser.name, email: savedUser.email, role: savedUser.role },
        },
      });
    }

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: {
        user: savedUser.toObject({ virtuals: false, versionKey: false }),
      },
    });
  } catch (error) {
    console.error("❌ Error creating user:", error);

    // Handle duplicate key error (multiple null googleIds)
    if (error.code === 11000 && error.keyPattern?.googleId && newUser) {
      console.log("🔄 Duplicate googleId error - trying with unique ID...");

      try {
        // Generate a unique googleId for manual users
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        newUser.googleId = `manual_${timestamp}_${randomSuffix}`;

        const savedUser = await newUser.save();
        console.log("✅ User saved with generated googleId");

        // Audit log for user creation (retry path)
        if (req.user) {
          await AuditLog.logEvent({
            userId: req.user._id,
            userEmail: req.user.email,
            userName: req.user.name,
            action: "USER_CREATE",
            category: "user",
            description: `Created user: ${savedUser.email}`,
            severity: "info",
            metadata: {
              targetId: savedUser._id,
              targetType: "User",
              newValue: { name: savedUser.name, email: savedUser.email, role: savedUser.role },
            },
          });
        }

        console.log("✅ Sending response:", {
          success: true,
          message: "User created successfully",
          userId: savedUser._id,
          email: savedUser.email,
        });

        res.status(201).json({
          success: true,
          message: "User created successfully",
          data: {
            user: savedUser.toObject({ virtuals: false, versionKey: false }),
          },
        });
      } catch (retryError) {
        console.error("❌ Retry also failed:", retryError);
        res.status(500).json({
          success: false,
          message: "Error creating user (duplicate email or googleId)",
          error: retryError.message,
        });
      }
    } else {
      res.status(500).json({
        success: false,
        message: "Error creating user",
        error: error.message,
      });
    }
  }
};

// Get all users with pagination and filters
const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      role,
      isActive,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter object
    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    if (role) {
      const roleString = Array.isArray(role) ? role.join(",") : role;
      const roles = roleString.split(",");
      if (roles.length > 1) {
        filter.role = { $in: roles };
      } else {
        filter.role = roles[0];
      }
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Get users with pagination
    const users = await User.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select("-googleId"); // Exclude googleId from response

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalUsers: total,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message,
    });
  }
};

// Get user by ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select("-googleId");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching user",
      error: error.message,
    });
  }
};

// Update user
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    console.log(`[UpdateUser] Updating user ${id} with:`, JSON.stringify(updates, null, 2));

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // [SECURITY] Check for ITSS Student Management (Disable/Enable)
    const isITSS = req.user.position === "ITSS";
    if (isITSS) {
      if (user.role !== "student" && user.role !== "club-officer") {
        return res.status(403).json({
          success: false,
          message: "ITSS can only manage Student and PBOO accounts",
        });
      }
      
      // Ensure ITSS is only updating 'isActive'
      const allowedUpdates = ["isActive"];
      const updateKeys = Object.keys(updates);
      const hasUnauthorizedUpdates = updateKeys.some(key => !allowedUpdates.includes(key));

      if (hasUnauthorizedUpdates) {
        return res.status(403).json({
          success: false,
          message: "ITSS can only update the active status of students",
        });
      }
      // If validation passes, fall through to update logic
    } else {
      // [SECURITY] Check for PBOO (Club Officer) management permissions
      const isChangingToPBOO = updates.role === "club-officer";
      const isRemovingPBOO = user.role === "club-officer" && updates.role && updates.role !== "club-officer";

      if (isChangingToPBOO || isRemovingPBOO) {
        // Only PSAS Head can manage PBOO roles
        if (req.user.position !== "PSAS Head") {
           return res.status(403).json({
            success: false,
            message: "Only the PSAS Head can manage PBOO (Club Officer) roles",
          });
        }
      } else {
        // For all OTHER updates, ensure user is MIS (PSAS Head can only touch PBOO roles)
        // This prevents PSAS users from updating arbitrary fields or other roles
        if (req.user.role !== "mis" && !isChangingToPBOO && !isRemovingPBOO) {
           return res.status(403).json({
            success: false,
            message: "You do not have permission to perform this update",
          });
        }
      }
    }

    // Check for Head status change restriction
    const isChangingToHead = updates.position?.includes("Head");
    const isRemovingHead = user.position?.includes("Head") && updates.position && !updates.position.includes("Head");

    if (isChangingToHead || isRemovingHead) {
      // STRICTLY limit Head/ITSS position management to MIS Head only
      if (req.user.position !== "MIS Head") {
        return res.status(403).json({
          success: false,
          message: "Only the MIS Head can manage Head/ITSS positions",
        });
      }
    }

    // Check for email conflicts if email is being updated
    if (updates.email && updates.email !== user.email) {
      const existingUser = await User.findOne({ email: updates.email });
      if (existingUser && existingUser._id.toString() !== id) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    // Capture old values for logging
    const oldRole = user.role;
    const oldStatus = user.isActive;

    // Handle role elevation to club-officer with automatic expiration
    if (updates.role === "club-officer" && user.role !== "club-officer") {
      // User is being elevated to club-officer
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

      updates.roleExpiresAt = oneYearFromNow;
      updates.previousRole = user.role;
      updates.elevationDate = new Date();
      updates.elevatedBy = req.user?._id || null;

      console.log(
        `[RoleElevation] User ${user.email} elevated to club-officer, expires at ${oneYearFromNow.toISOString()}`,
      );
    }

    // If role is being changed away from club-officer, clear expiration fields
    if (
      updates.role &&
      updates.role !== "club-officer" &&
      user.role === "club-officer"
    ) {
      updates.roleExpiresAt = null;
      updates.previousRole = null;
      updates.elevationDate = null;
      updates.elevatedBy = null;
    }

    // Handle permissions Map specifically to ensure persistence
    if (updates.permissions && typeof updates.permissions === "object") {
      Object.entries(updates.permissions).forEach(([key, value]) => {
        user.permissions.set(key, value);
      });
      user.markModified("permissions");
      delete updates.permissions;
    }

    // Explicitly set fields to ensure they are updated
    if (updates.position !== undefined) user.position = updates.position;
    if (updates.elevationDate !== undefined) user.elevationDate = updates.elevationDate;
    if (updates.program !== undefined) user.program = updates.program;
    if (updates.role !== undefined) user.role = updates.role;
    if (updates.isActive !== undefined) user.isActive = updates.isActive;

    // Update other user fields using .set() for any remaining fields
    user.set(updates);

    const savedUser = await user.save();
    console.log(`[UpdateUser] Saved user:`, JSON.stringify(savedUser.toObject(), null, 2));

    // AUDIT LOGGING
    // Log Role Change
    if (updates.role && updates.role !== oldRole) {
      await AuditLog.logEvent({
        userId: req.user._id,
        userEmail: req.user.email,
        userName: req.user.name,
        action: "ROLE_CHANGE",
        category: "user",
        description: `Changed role of ${user.email} from ${oldRole} to ${updates.role}`,
        severity: "warning",
        metadata: {
          targetId: user._id,
          targetType: "User",
          oldValue: oldRole,
          newValue: updates.role,
        },
      });
    }

    // Log Status Change (Suspend/Activate)
    if (updates.isActive !== undefined && updates.isActive !== oldStatus) {
      const isActive = updates.isActive;
      await AuditLog.logEvent({
        userId: req.user._id,
        userEmail: req.user.email,
        userName: req.user.name,
        action: isActive ? "USER_ACTIVATED" : "USER_SUSPENDED",
        category: "user",
        description: `${isActive ? "Activated" : "Suspended"} user ${user.name} (${user.email})`,
        severity: "warning",
        metadata: {
          targetId: user._id,
          targetType: "User",
          targetName: user.name,
          oldValue: oldStatus,
          newValue: isActive,
        },
      });
    }

    res.json({
      success: true,
      message: "User updated successfully",
      data: {
        user: savedUser.toObject({ virtuals: false, versionKey: false }),
      },
    });

    // Emit socket event for real-time updates
    emitUpdate("user-updated", { userId: user._id });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating user",
      error: error.message,
    });
  }
};

// Delete/Deactivate user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Capture user details before deletion for audit log
    const deletedUserDetails = {
      name: user.name,
      email: user.email,
      role: user.role,
    };

    // Permanently delete user
    await User.findByIdAndDelete(id);

    // Audit log for user deletion
    if (req.user) {
      await AuditLog.logEvent({
        userId: req.user._id,
        userEmail: req.user.email,
        userName: req.user.name,
        action: "USER_DELETE",
        category: "user",
        description: `Deleted user: ${deletedUserDetails.email}`,
        severity: "critical",
        metadata: {
          targetId: id,
          targetType: "User",
          oldValue: deletedUserDetails,
        },
      });
    }

    res.json({
      success: true,
      message: "User permanently deleted",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: error.message,
    });
  }
};

// Get user statistics for admin dashboard
const getUserStats = async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: {
            $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
          },
          inactiveUsers: {
            $sum: { $cond: [{ $eq: ["$isActive", false] }, 1, 0] },
          },
          adminUsers: {
            $sum: { $cond: [{ $eq: ["$role", "admin"] }, 1, 0] },
          },
          regularUsers: {
            $sum: { $cond: [{ $eq: ["$role", "user"] }, 1, 0] },
          },
          usersWithGoogle: {
            $sum: { $cond: [{ $ne: ["$googleId", null] }, 1, 0] },
          },
        },
      },
    ]);

    // Get recent users (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentUsers = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Get users who logged in recently (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeRecentUsers = await User.countDocuments({
      lastLogin: { $gte: sevenDaysAgo },
    });

    const result = stats[0] || {
      totalUsers: 0,
      activeUsers: 0,
      inactiveUsers: 0,
      adminUsers: 0,
      regularUsers: 0,
      usersWithGoogle: 0,
    };

    res.json({
      success: true,
      data: {
        ...result,
        recentUsers,
        activeRecentUsers,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching user statistics",
      error: error.message,
    });
  }
};

// Bulk update users
const bulkUpdateUsers = async (req, res) => {
  try {
    const { userIds, updates } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "User IDs array is required",
      });
    }

    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { $set: updates },
      { new: true },
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} users updated successfully`,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error bulk updating users",
      error: error.message,
    });
  }
};

// Bulk update user status (activate/deactivate)
const bulkUpdateStatus = async (req, res) => {
  try {
    const { userIds, isActive } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "User IDs array is required",
      });
    }

    if (isActive === undefined) {
      return res.status(400).json({
        success: false,
        message: "isActive status is required",
      });
    }

    // [SECURITY] Check permissions
    const isMis = req.user.role === "mis";
    const isItss = req.user.role === "psas" && req.user.position === "ITSS";

    if (!isMis && !isItss) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to bulk update user status",
      });
    }

    // Get the users to be updated to check their roles/details for logging
    const targetUsers = await User.find({ _id: { $in: userIds } });

    if (isItss) {
      // ITSS can only manage student and club-officer (PBOO) roles
      const invalidUsers = targetUsers.filter(u => u.role !== "student" && u.role !== "club-officer");
      if (invalidUsers.length > 0) {
        return res.status(403).json({
          success: false,
          message: "ITSS can only bulk update Student and PBOO (Club Officer) accounts",
        });
      }
    }

    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { $set: { isActive } }
    );

    // AUDIT LOGGING
    const action = isActive ? "BULK_USER_ACTIVATED" : "BULK_USER_SUSPENDED";
    const roleString = isItss ? "Student/PBOO" : "User";
    
    await AuditLog.logEvent({
      userId: req.user._id,
      userEmail: req.user.email,
      userName: req.user.name,
      action: action,
      category: "user",
      description: `${isActive ? "Activated" : "Suspended"} ${result.modifiedCount} ${roleString} accounts bulk`,
      severity: "warning",
      metadata: {
        userIds,
        modifiedCount: result.modifiedCount,
        targetRoles: isItss ? ["student", "club-officer"] : "all",
      },
    });

    res.json({
      success: true,
      message: `${result.modifiedCount} users updated successfully`,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      },
    });

    // Emit socket update
    emitUpdate("users-bulk-updated", { userIds, isActive });
  } catch (error) {
    console.error("Error bulk updating user status:", error);
    res.status(500).json({
      success: false,
      message: "Error bulk updating user status",
      error: error.message,
    });
  }
};

// Provision a new user with specific permissions
const provisionUser = async (req, res) => {
  try {
    const { email, role, permissions } = req.body;

    if (!email || !role) {
      return res.status(400).json({
        success: false,
        message: "Email and role are required",
      });
    }

    // [SECURITY] Check permissions for provisioning
    const isMis = req.user.role === "mis";
    const isMisHead = isMis && req.user.position === "MIS Head";
    const isItss = req.user.role === "psas" && req.user.position === "ITSS";

    if (!isMis && !isItss) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to provision users",
      });
    }

    // [SECURITY] Role restrictions
    if (isItss) {
      if (role !== "student") {
        return res.status(403).json({
          success: false,
          message: "ITSS can only provision Student accounts",
        });
      }
    } else if (isMis) {
      // MIS Staff restrictions
      if (role === "student") {
        return res.status(403).json({
          success: false,
          message:
            "MIS users cannot provision Student accounts. Please ask the ITSS.",
        });
      }
      if (role === "mis" && !isMisHead) {
        return res.status(403).json({
          success: false,
          message: "Only the MIS Head can provision other MIS Staff accounts",
        });
      }
    }

    // [VALIDATION] Enforce email domain policies
    const isValidEmail = (email) => {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@laverdad\.edu\.ph$/;
      return emailRegex.test(email);
    };

    const isValidStudentEmail = (email) => {
      const studentEmailRegex = /^[a-zA-Z0-9._%+-]+@student\.laverdad\.edu\.ph$/;
      return studentEmailRegex.test(email);
    };

    if (role === "student") {
      if (!isValidStudentEmail(email)) {
        return res.status(400).json({
          success: false,
          message: "Student emails must be valid and end with @student.laverdad.edu.ph",
        });
      }
    } else {
      // For NON-students (MIS, PSAS, etc.), enforce @laverdad.edu.ph
      if (!isValidEmail(email)) {
        return res.status(400).json({
          success: false,
          message: "Staff emails must be valid and end with @laverdad.edu.ph",
        });
      }
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Create user with parsed name from email
    const name = email
      .split("@")[0]
      .replace(/[._]/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    const newUser = new User({
      name: name,
      email,
      role,
      permissions: permissions || {},
      isActive: true,
    });

    const savedUser = await newUser.save();

    res.status(201).json({
      success: true,
      message: "User provisioned successfully",
      data: {
        user: savedUser.toObject({ virtuals: false, versionKey: false }),
      },
    });
  } catch (error) {
    console.error("Error provisioning user:", error);
    res.status(500).json({
      success: false,
      message: "Error provisioning user",
      error: error.message,
    });
  }
};

module.exports = {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserStats,
  bulkUpdateUsers,
  bulkUpdateStatus,
  provisionUser,
};
