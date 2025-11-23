const express = require("express");
const router = express.Router();
const passport = require("passport");
const jwt = require("jsonwebtoken");
const User = require("../../models/User");

// Google OAuth routes
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    session: false,
  }),
  (req, res) => {
    // Generate JWT token with role information and profile picture
    const token = jwt.sign(
      {
        id: req.user._id,
        email: req.user.email,
        role: req.user.role,
        isActive: req.user.isActive,
        profilePicture: req.user.profilePicture,
        department: req.user.department,
        position: req.user.position,
        country: req.user.country,
        timezone: req.user.timezone,
        muteNotifications: req.user.muteNotifications,
        muteReminders: req.user.muteReminders,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Redirect to client with token
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
  }
);

// Get current user profile
router.get("/profile", async (req, res) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Return user data with role information and profile picture
    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          profilePicture: user.profilePicture,
          department: user.department,
          position: user.position,
          country: user.country,
          timezone: user.timezone,
          muteNotifications: user.muteNotifications,
          muteReminders: user.muteReminders,
        },
      },
    });
  } catch (error) {
    console.error("Error in profile route:", error);
    res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
});

// Update user profile
router.put("/profile", async (req, res) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update allowed fields
    const {
      department,
      position,
      country,
      timezone,
      muteNotifications,
      muteReminders,
    } = req.body;

    if (department !== undefined) user.department = department;
    if (position !== undefined) user.position = position;
    if (country !== undefined) user.country = country;
    if (timezone !== undefined) user.timezone = timezone;
    if (muteNotifications !== undefined)
      user.muteNotifications = muteNotifications;
    if (muteReminders !== undefined) user.muteReminders = muteReminders;

    await user.save();

    // Return updated user data
    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          profilePicture: user.profilePicture,
          department: user.department,
          position: user.position,
          country: user.country,
          timezone: user.timezone,
          muteNotifications: user.muteNotifications,
          muteReminders: user.muteReminders,
        },
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({
      success: false,
      message: "Error updating profile",
    });
  }
});

// Upload profile picture
router.post("/profile/picture", async (req, res) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const { profilePicture } = req.body;

    if (!profilePicture) {
      return res.status(400).json({
        success: false,
        message: "No image provided",
      });
    }

    // Validate base64 image (should start with data:image/)
    if (!profilePicture.startsWith("data:image/")) {
      return res.status(400).json({
        success: false,
        message: "Invalid image format",
      });
    }

    // Check file size (limit to 5MB)
    const base64Length =
      profilePicture.length - "data:image/png;base64,".length;
    const sizeInBytes = (base64Length * 3) / 4;
    const sizeInMB = sizeInBytes / (1024 * 1024);

    if (sizeInMB > 5) {
      return res.status(400).json({
        success: false,
        message: "Image size must be less than 5MB",
      });
    }

    // Update profile picture
    user.profilePicture = profilePicture;
    await user.save();

    // Return updated user data
    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          profilePicture: user.profilePicture,
          department: user.department,
          position: user.position,
          country: user.country,
          timezone: user.timezone,
          muteNotifications: user.muteNotifications,
          muteReminders: user.muteReminders,
        },
      },
    });
  } catch (error) {
    console.error("Error uploading profile picture:", error);
    res.status(500).json({
      success: false,
      message: "Error uploading profile picture",
    });
  }
});

// Remove profile picture
router.delete("/profile/picture", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ success: false, message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Revert to Google picture (avatar) if available, otherwise null
    user.profilePicture = user.avatar || null;
    await user.save();

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          profilePicture: user.profilePicture,
          department: user.department,
          position: user.position,
          country: user.country,
          timezone: user.timezone,
          muteNotifications: user.muteNotifications,
          muteReminders: user.muteReminders,
        },
      },
    });
  } catch (error) {
    console.error("Error removing profile picture:", error);
    res
      .status(500)
      .json({ success: false, message: "Error removing profile picture" });
  }
});

module.exports = router;
