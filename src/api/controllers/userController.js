const User = require("../../models/User");
const { generateToken } = require("../../middlewares/auth");

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

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log("❌ Email already exists:", email);
      return res.status(400).json({
        success: false,
        message: "Email already exists",
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
      filter.role = role;
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

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
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

    // Update user fields
    Object.keys(updates).forEach((key) => {
      user[key] = updates[key];
    });

    const savedUser = await user.save();

    res.json({
      success: true,
      message: "User updated successfully",
      data: {
        user: savedUser.toObject({ virtuals: false, versionKey: false }),
      },
    });
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

    // Permanently delete user
    await User.findByIdAndDelete(id);
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

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Create user with parsed name from email
    const name = email.split("@")[0].replace(/[._]/g, " ");

    const newUser = new User({
      name: name.charAt(0).toUpperCase() + name.slice(1),
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
  provisionUser,
};
