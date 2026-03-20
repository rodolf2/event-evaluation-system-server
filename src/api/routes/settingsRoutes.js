const express = require("express");
const router = express.Router();
const SystemSettings = require("../../models/SystemSettings");
const AuditLog = require("../../models/AuditLog");
const { requireAuth, requireRole } = require("../../middlewares/auth");

// Helper to calculate changes between old and new settings
const calculateChanges = (oldSettings, newSettings, prefix = "") => {
  const changes = {};
  
  const compareObjects = (oldObj, newObj, path) => {
    Object.keys(newObj).forEach(key => {
      const currentPath = path ? `${path}.${key}` : key;
      const oldValue = oldObj ? oldObj[key] : undefined;
      const newValue = newObj[key];
      
      // Skip if values are the same
      if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return;
      
      // If it's a nested object (and not an array or date), recurse
      if (
        typeof newValue === "object" && 
        newValue !== null && 
        !Array.isArray(newValue) && 
        !(newValue instanceof Date) &&
        oldValue && 
        typeof oldValue === "object"
      ) {
        compareObjects(oldValue, newValue, currentPath);
      } else {
        // Record change
        changes[currentPath] = {
          old: oldValue,
          new: newValue
        };
      }
    });
  };

  compareObjects(oldSettings, newSettings, prefix);
  return changes;
};

// GET /api/settings - Get system settings
router.get(
  "/",
  requireAuth,
  requireRole(["mis", "superadmin", "psas"]),
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
  requireRole(["mis", "superadmin", "psas"]),
  async (req, res) => {
    try {
      const {
        guestSettings,
        emailSettings,
        generalSettings,
        securitySettings,
        nlpSettings,
      } = req.body;
      
      // RESTRICTION: Only MIS Head or PSAS Head or Assistant Department Head can update general/security settings
      const isAuthorizedHead = req.user.position === "MIS Head" || req.user.position === "PSAS Head" || req.user.position === "Assistant Department Head";

      if ((generalSettings || securitySettings || nlpSettings) && !isAuthorizedHead) {
        return res.status(403).json({
          success: false,
          message: "Only the MIS Head or PSAS Head can modify system configuration",
        });
      }

      // 1. Fetch OLD settings
      const oldSettings = await SystemSettings.getSettings();

      // 2. Update settings
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

      // 3. Calculate Changes
      // We need to compare specific sections because updateSettings merges
      const changes = {};
      
      if (guestSettings) Object.assign(changes, calculateChanges(oldSettings.guestSettings, guestSettings, "guestSettings"));
      if (emailSettings) Object.assign(changes, calculateChanges(oldSettings.emailSettings, emailSettings, "emailSettings"));
      if (generalSettings) Object.assign(changes, calculateChanges(oldSettings.generalSettings, generalSettings, "generalSettings"));
      if (securitySettings) Object.assign(changes, calculateChanges(oldSettings.securitySettings, securitySettings, "securitySettings"));
      if (nlpSettings) Object.assign(changes, calculateChanges(oldSettings.nlpSettings, nlpSettings, "nlpSettings"));

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
        metadata: {
          changes: changes
        }
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

// ... (skipping guest routes) ...


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

      // 1. Fetch OLD settings
      const oldSettings = await SystemSettings.getSettings();
      const oldGuestSettings = oldSettings.guestSettings.toObject();

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

      // 3. Calculate changes
      const changes = calculateChanges(oldGuestSettings, {
        defaultExpirationDays,
        allowGuestEvaluators,
        allowGuestSpeakers,
      }, "guestSettings");

      await AuditLog.logEvent({
        userId: req.user._id,
        userName: req.user.name,
        userEmail: req.user.email,
        action: "SYSTEM_SETTINGS_UPDATE",
        category: "settings",
        description: `Updated guest settings`,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        severity: "info",
        metadata: {
          changes: changes
        }
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
  requireRole(["mis", "superadmin", "psas"]),
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
  requireRole(["mis", "superadmin", "psas"]),
  async (req, res) => {
    try {
      const generalSettingsUpdate = req.body;
      
      // RESTRICTION: Only MIS Head or PSAS Head or Assistant Department Head can update general settings
      const isAuthorizedHead = req.user.position === "MIS Head" || req.user.position === "PSAS Head" || req.user.position === "Assistant Department Head";

      if (!isAuthorizedHead) {
        return res.status(403).json({
          success: false,
          message: "Only the MIS Head or PSAS Head can modify general system settings",
        });
      }

      // 1. Fetch OLD settings
      const oldSettings = await SystemSettings.getSettings();
      const oldGeneralSettings = oldSettings.generalSettings.toObject();

      const settings = await SystemSettings.updateSettings(
        { generalSettings: generalSettingsUpdate },
        req.user._id
      );

      // 3. Calculate changes
      const changes = calculateChanges(oldGeneralSettings, generalSettingsUpdate, "generalSettings");

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
        metadata: {
          changes: changes
        }
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
  requireRole(["mis", "superadmin", "psas"]),
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
  requireRole(["mis", "superadmin", "psas"]),
  async (req, res) => {
    try {
      const securitySettingsUpdate = req.body;
      
      // RESTRICTION: Only MIS Head or PSAS Head or Assistant Department Head can update security settings
      const isAuthorizedHead = req.user.position === "MIS Head" || req.user.position === "PSAS Head" || req.user.position === "Assistant Department Head";

      if (!isAuthorizedHead) {
        return res.status(403).json({
          success: false,
          message: "Only the MIS Head or PSAS Head can modify security settings",
        });
      }

      // 1. Fetch OLD settings
      const oldSettings = await SystemSettings.getSettings();
      const oldSecuritySettings = oldSettings.securitySettings.toObject();

      const settings = await SystemSettings.updateSettings(
        { securitySettings: securitySettingsUpdate },
        req.user._id
      );

      // 3. Calculate changes
      const changes = calculateChanges(oldSecuritySettings, securitySettingsUpdate, "securitySettings");

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
        metadata: {
          changes: changes
        }
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
