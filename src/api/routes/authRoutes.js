const express = require("express");
const router = express.Router();
const passport = require("passport");
const jwt = require("jsonwebtoken");
const User = require("../../models/User");
const { requireAuth } = require("../../middlewares/auth");
const { createAuditLog } = require("../controllers/auditLogController");

// Google OAuth routes
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  }),
);

router.get(
  "/google/callback",
  (req, res, next) => {
    passport.authenticate("google", { session: false }, (err, user, info) => {
      // Handle error
      if (err) {
        console.error("Google OAuth error:", err);
        return res.redirect(
          `${process.env.CLIENT_URL}/login?error=oauth_error`,
        );
      }

      // Handle authentication failure (e.g., domain restriction)
      if (!user) {
        const errorMessage = info?.message || "Authentication failed";
        // Log failed login attempt
        const ipAddress =
          req.headers["x-forwarded-for"] ||
          req.connection?.remoteAddress ||
          "Unknown";
        createAuditLog({
          action: "FAILED_LOGIN",
          category: "security",
          description: `Failed login attempt: ${errorMessage}`,
          ipAddress:
            typeof ipAddress === "string"
              ? ipAddress.split(",")[0].trim()
              : "Unknown",
          severity: "warning",
          status: "failure",
        });
        // Encode the message for URL
        const encodedError = encodeURIComponent(errorMessage);
        return res.redirect(
          `${process.env.CLIENT_URL}/login?error=access_denied&message=${encodedError}`,
        );
      }

      // Check if user account is active
      if (!user.isActive) {
        // Log inactive account login attempt
        const ipAddress =
          req.headers["x-forwarded-for"] ||
          req.connection?.remoteAddress ||
          "Unknown";
        createAuditLog({
          userId: user._id,
          userName: user.name,
          userEmail: user.email,
          userRole: user.role,
          action: "FAILED_LOGIN",
          category: "security",
          description: `Login attempt by inactive account: ${user.email}`,
          ipAddress:
            typeof ipAddress === "string"
              ? ipAddress.split(",")[0].trim()
              : "Unknown",
          severity: "warning",
          status: "failure",
        });
        return res.redirect(
          `${process.env.CLIENT_URL}/login?error=account_inactive`,
        );
      }

      // Attach user to request and continue
      req.user = user;
      next();
    })(req, res, next);
  },
  async (req, res) => {
    // Update lastLogin timestamp
    req.user.lastLogin = Date.now();
    await req.user.save();

    // Log the login event to audit logs
    const ipAddress =
      req.headers["x-forwarded-for"] ||
      req.connection?.remoteAddress ||
      "Unknown";
    await createAuditLog({
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: "USER_LOGIN",
      category: "auth",
      description: `User ${req.user.name} logged in via Google SSO`,
      ipAddress:
        typeof ipAddress === "string"
          ? ipAddress.split(",")[0].trim()
          : "Unknown",
      severity: "info",
      status: "success",
    });

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
        hasCompletedOnboarding: req.user.hasCompletedOnboarding,
        onboardingStep: req.user.onboardingStep,
        onboardingCompletedAt: req.user.onboardingCompletedAt,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    // Redirect to client with token
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
  },
);

const Event = require("../../models/Event");
const SystemSettings = require("../../models/SystemSettings");

// Guest login route
router.post("/guest", async (req, res) => {
  try {
    const { name, email, role, verificationCode } = req.body;

    // Validate required fields
    if (!name || !email || !role || !verificationCode) {
      return res.status(400).json({
        success: false,
        message: "Name, email, role, and verification code are required",
      });
    }

    // Validate role is either evaluator or guest-speaker
    if (role !== "evaluator" && role !== "guest-speaker") {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Must be 'evaluator' or 'guest-speaker'",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // Find event by verification code
    const event = await Event.findOne({ verificationCode });
    if (!event) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code",
      });
    }

    // Check if user is in attendees list
    const normalizedEmail = email.toLowerCase().trim();
    const attendee = event.attendees.find(
      (att) =>
        att.email.toLowerCase() === normalizedEmail &&
        att.name.toLowerCase() === name.toLowerCase().trim(),
    );

    if (!attendee) {
      return res.status(403).json({
        success: false,
        message: "You are not registered as an attendee for this event",
      });
    }

    // Find or create guest user
    let user = await User.findOne({ email: normalizedEmail, role });

    // Get expiration days: event setting > system default > 30 days
    const systemSettings = await SystemSettings.getSettings();
    const systemDefault =
      systemSettings.guestSettings?.defaultExpirationDays || 30;
    const daysUntilExpiry = event.guestExpirationDays || systemDefault;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + daysUntilExpiry);

    if (!user) {
      // Create new guest user with expiration
      user = new User({
        name: attendee.name,
        email: normalizedEmail,
        role,
        isActive: true,
        isGuest: true,
        expiresAt,
        expirationDays: daysUntilExpiry,
      });
      await user.save();
    } else {
      // Check if existing user is active
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message:
            "Your account has been deactivated. Please contact an administrator.",
        });
      }
      // Update last login and extend expiration
      user.lastLogin = Date.now();
      user.expiresAt = expiresAt;
      user.expirationDays = daysUntilExpiry;
      await user.save();
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user._id,
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
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        onboardingStep: user.onboardingStep,
        onboardingCompletedAt: user.onboardingCompletedAt,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    // Log the guest login event to audit logs
    const ipAddress =
      req.headers["x-forwarded-for"] ||
      req.connection?.remoteAddress ||
      "Unknown";
    await createAuditLog({
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: "GUEST_LOGIN",
      category: "auth",
      description: `Guest ${user.name} (${role}) logged in for event: ${event.name}`,
      ipAddress:
        typeof ipAddress === "string"
          ? ipAddress.split(",")[0].trim()
          : "Unknown",
      severity: "info",
      status: "success",
    });

    res.json({
      success: true,
      data: {
        token,
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
          hasCompletedOnboarding: user.hasCompletedOnboarding,
          onboardingStep: user.onboardingStep,
          onboardingCompletedAt: user.onboardingCompletedAt,
        },
        event: {
          _id: event._id,
          name: event.name,
          date: event.date,
        },
      },
    });
  } catch (error) {
    console.error("Error in guest login:", error);
    res.status(500).json({
      success: false,
      message: "Error processing guest login",
    });
  }
});

// Get current user profile
router.get("/profile", requireAuth, async (req, res) => {
  try {
    const user = req.user;

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
          hasCompletedOnboarding: user.hasCompletedOnboarding,
          onboardingStep: user.onboardingStep,
          onboardingCompletedAt: user.onboardingCompletedAt,
          permissions: user.permissions
            ? Object.fromEntries(user.permissions)
            : {},
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
router.put("/profile", requireAuth, async (req, res) => {
  try {
    const user = req.user;

    // Update allowed fields
    const {
      department,
      position,
      country,
      timezone,
      muteNotifications,
      muteReminders,
      onboardingStep,
      hasCompletedOnboarding,
      onboardingCompletedAt,
    } = req.body;

    if (department !== undefined) user.department = department;
    if (position !== undefined) user.position = position;
    if (country !== undefined) user.country = country;
    if (timezone !== undefined) user.timezone = timezone;
    if (muteNotifications !== undefined)
      user.muteNotifications = muteNotifications;
    if (muteReminders !== undefined) user.muteReminders = muteReminders;
    if (onboardingStep !== undefined) user.onboardingStep = onboardingStep;
    if (hasCompletedOnboarding !== undefined)
      user.hasCompletedOnboarding = hasCompletedOnboarding;
    if (onboardingCompletedAt !== undefined)
      user.onboardingCompletedAt = onboardingCompletedAt;

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
          hasCompletedOnboarding: user.hasCompletedOnboarding,
          onboardingStep: user.onboardingStep,
          onboardingCompletedAt: user.onboardingCompletedAt,
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
router.post("/profile/picture", requireAuth, async (req, res) => {
  try {
    const user = req.user;

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
          hasCompletedOnboarding: user.hasCompletedOnboarding,
          onboardingStep: user.onboardingStep,
          onboardingCompletedAt: user.onboardingCompletedAt,
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
          hasCompletedOnboarding: user.hasCompletedOnboarding,
          onboardingStep: user.onboardingStep,
          onboardingCompletedAt: user.onboardingCompletedAt,
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
