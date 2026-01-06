const express = require("express");
const router = express.Router();
const SystemSettings = require("../../models/SystemSettings");
const AuditLog = require("../../models/AuditLog");
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
      const {
        guestSettings,
        emailSettings,
        generalSettings,
        securitySettings,
        nlpSettings,
      } = req.body;

      const settings = await SystemSettings.updateSettings(
        {
          guestSettings,
          emailSettings,
          generalSettings,
          securitySettings,
          nlpSettings,
        },
        req.user._id
      );

      await AuditLog.logEvent({
        userId: req.user._id,
        userName: req.user.name,
        userEmail: req.user.email,
        action: "SYSTEM_SETTINGS_UPDATE",
        category: "settings",
        description: "Updated system settings",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        severity: "warning",
      });

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

      await AuditLog.logEvent({
        userId: req.user._id,
        userName: req.user.name,
        userEmail: req.user.email,
        action: "SYSTEM_SETTINGS_UPDATE",
        category: "settings",
        description: `Updated guest settings: Expiration ${defaultExpirationDays} days`,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        severity: "info",
      });

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

// GET /api/settings/general - Get general settings only
router.get(
  "/general",
  requireAuth,
  requireRole(["mis", "superadmin"]),
  async (req, res) => {
    try {
      const settings = await SystemSettings.getSettings();
      res.json({
        success: true,
        data: settings.generalSettings,
      });
    } catch (error) {
      console.error("Error fetching general settings:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch general settings",
        error: error.message,
      });
    }
  }
);

// PUT /api/settings/general - Update general settings
router.put(
  "/general",
  requireAuth,
  requireRole(["mis", "superadmin"]),
  async (req, res) => {
    try {
      const generalSettings = req.body;

      const settings = await SystemSettings.updateSettings(
        { generalSettings },
        req.user._id
      );

      await AuditLog.logEvent({
        userId: req.user._id,
        userName: req.user.name,
        userEmail: req.user.email,
        action: "SYSTEM_SETTINGS_UPDATE",
        category: "settings",
        description: "Updated general settings",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        severity: "info",
      });

      res.json({
        success: true,
        message: "General settings updated successfully",
        data: settings.generalSettings,
      });
    } catch (error) {
      console.error("Error updating general settings:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update general settings",
        error: error.message,
      });
    }
  }
);

// GET /api/settings/security - Get security settings only
router.get(
  "/security",
  requireAuth,
  requireRole(["mis", "superadmin"]),
  async (req, res) => {
    try {
      const settings = await SystemSettings.getSettings();
      res.json({
        success: true,
        data: settings.securitySettings,
      });
    } catch (error) {
      console.error("Error fetching security settings:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch security settings",
        error: error.message,
      });
    }
  }
);

// PUT /api/settings/security - Update security settings
router.put(
  "/security",
  requireAuth,
  requireRole(["mis", "superadmin"]),
  async (req, res) => {
    try {
      const securitySettings = req.body;

      const settings = await SystemSettings.updateSettings(
        { securitySettings },
        req.user._id
      );

      await AuditLog.logEvent({
        userId: req.user._id,
        userName: req.user.name,
        userEmail: req.user.email,
        action: "SYSTEM_SETTINGS_UPDATE",
        category: "settings",
        description: "Updated security settings",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        severity: "warning",
      });

      res.json({
        success: true,
        message: "Security settings updated successfully",
        data: settings.securitySettings,
      });
    } catch (error) {
      console.error("Error updating security settings:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update security settings",
        error: error.message,
      });
    }
  }
);

module.exports = router;
