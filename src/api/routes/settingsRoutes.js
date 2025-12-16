const express = require("express");
const router = express.Router();
const SystemSettings = require("../../models/SystemSettings");
const { requireAuth, requireRole } = require("../../middlewares/auth");

// GET /api/settings - Get system settings
router.get(
  "/",
  requireAuth,
  requireRole(["mis", "superadmin"]),
  async (req, res) => {
    try {
      const settings = await SystemSettings.getSettings();
      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch settings",
        error: error.message,
      });
    }
  }
);

// PUT /api/settings - Update system settings
router.put(
  "/",
  requireAuth,
  requireRole(["mis", "superadmin"]),
  async (req, res) => {
    try {
      const { guestSettings, emailSettings } = req.body;

      const settings = await SystemSettings.updateSettings(
        { guestSettings, emailSettings },
        req.user._id
      );

      res.json({
        success: true,
        message: "Settings updated successfully",
        data: settings,
      });
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update settings",
        error: error.message,
      });
    }
  }
);

// GET /api/settings/guest - Get guest settings only
router.get(
  "/guest",
  requireAuth,
  requireRole(["mis", "superadmin", "psas"]),
  async (req, res) => {
    try {
      const settings = await SystemSettings.getSettings();
      res.json({
        success: true,
        data: {
          defaultExpirationDays: settings.guestSettings.defaultExpirationDays,
          allowGuestEvaluators: settings.guestSettings.allowGuestEvaluators,
          allowGuestSpeakers: settings.guestSettings.allowGuestSpeakers,
        },
      });
    } catch (error) {
      console.error("Error fetching guest settings:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch guest settings",
        error: error.message,
      });
    }
  }
);

// PUT /api/settings/guest - Update guest settings
router.put(
  "/guest",
  requireAuth,
  requireRole(["mis", "superadmin"]),
  async (req, res) => {
    try {
      const {
        defaultExpirationDays,
        allowGuestEvaluators,
        allowGuestSpeakers,
      } = req.body;

      const settings = await SystemSettings.updateSettings(
        {
          guestSettings: {
            defaultExpirationDays,
            allowGuestEvaluators,
            allowGuestSpeakers,
          },
        },
        req.user._id
      );

      res.json({
        success: true,
        message: "Guest settings updated successfully",
        data: settings.guestSettings,
      });
    } catch (error) {
      console.error("Error updating guest settings:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update guest settings",
        error: error.message,
      });
    }
  }
);

module.exports = router;
