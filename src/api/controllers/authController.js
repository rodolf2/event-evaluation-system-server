const User = require("../../models/User");
const { generateToken } = require("../../middlewares/auth");

// Handle successful Google OAuth login
const googleAuthCallback = async (req, res) => {
  try {
    const user = req.user;

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is inactive. Please contact administrator.",
      });
    }

    // Update last login
    await user.updateLastLogin();

    // Generate JWT token
    const token = generateToken(user);

    // Redirect to frontend with token
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error during authentication",
      error: error.message,
    });
  }
};

// Handle Google OAuth failure
const googleAuthFailure = (req, res) => {
  const message = req.flash("error")[0] || "Google authentication failed";
  res.status(401).json({
    success: false,
    message: message,
  });
};

// Logout user (client-side should remove token)
const logout = (req, res) => {
  res.json({
    success: true,
    message: "Logout successful",
  });
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-googleId");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User account is inactive",
      });
    }

    // If user has googleId, verify email matches Google profile
    if (user.googleId) {
      const googleUser = await User.findOne({ googleId: user.googleId });
      if (!googleUser || googleUser.email !== user.email) {
        return res.status(401).json({
          success: false,
          message:
            "Email mismatch with Google account. Please contact administrator.",
        });
      }
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching profile",
      error: error.message,
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { name, avatar } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (name) user.name = name;
    if (avatar) user.avatar = avatar;

    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: { user: user.toObject({ virtuals: false, versionKey: false }) },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating profile",
      error: error.message,
    });
  }
};

// Check authentication status
const checkAuth = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-googleId");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          role: user.role,
          isActive: user.isActive,
        },
        authenticated: true,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error checking authentication",
      error: error.message,
    });
  }
};

// Verify admin status
const verifyAdmin = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isAdmin = user.isSuperAdmin();

    res.json({
      success: true,
      data: {
        isAdmin,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error verifying admin status",
      error: error.message,
    });
  }
};

module.exports = {
  googleAuthCallback,
  googleAuthFailure,
  logout,
  getProfile,
  updateProfile,
  checkAuth,
  verifyAdmin,
};
