/**
 * Audit Logger Middleware
 * Logs user actions for comprehensive audit trail
 */

const AuditLog = require("../models/AuditLog");

// Action categories mapping
const ACTION_CATEGORIES = {
  // Auth actions
  USER_LOGIN: "auth",
  USER_LOGOUT: "auth",
  USER_REGISTER: "auth",
  PASSWORD_CHANGE: "auth",
  GUEST_LOGIN: "auth",

  // User actions
  USER_CREATE: "user",
  USER_UPDATE: "user",
  USER_DELETE: "user",
  ROLE_CHANGE: "user",
  PROFILE_UPDATE: "user",

  // Form actions
  FORM_CREATE: "form",
  FORM_UPDATE: "form",
  FORM_DELETE: "form",
  FORM_PUBLISH: "form",
  FORM_UNPUBLISH: "form",

  // Evaluation actions
  EVALUATION_START: "evaluation",
  EVALUATION_SUBMIT: "evaluation",
  EVALUATION_VIEW: "evaluation",

  // Certificate actions
  CERTIFICATE_CREATE: "certificate",
  CERTIFICATE_UPDATE: "certificate",
  CERTIFICATE_DELETE: "certificate",
  CERTIFICATE_DOWNLOAD: "certificate",

  // Report actions
  REPORT_GENERATE: "report",
  REPORT_VIEW: "report",
  REPORT_SHARE: "report",
  REPORT_DOWNLOAD: "report",

  // Notification actions
  NOTIFICATION_CREATE: "notification",
  NOTIFICATION_READ: "notification",

  // System actions
  SETTINGS_UPDATE: "settings",
  SYSTEM_CONFIG: "system",

  // Security actions
  RATE_LIMIT_HIT: "security",
  UNAUTHORIZED_ACCESS: "security",
  FAILED_LOGIN: "security",
  SUSPICIOUS_REQUEST: "security",
};

/**
 * Get severity based on action type
 */
const getSeverity = (action) => {
  const criticalActions = [
    "USER_DELETE",
    "ROLE_CHANGE",
    "FORM_DELETE",
    "CERTIFICATE_DELETE",
    "UNAUTHORIZED_ACCESS",
    "SUSPICIOUS_REQUEST",
  ];
  const warningActions = [
    "FAILED_LOGIN",
    "RATE_LIMIT_HIT",
    "PASSWORD_CHANGE",
    "SETTINGS_UPDATE",
  ];

  if (criticalActions.includes(action)) return "critical";
  if (warningActions.includes(action)) return "warning";
  return "info";
};

/**
 * Log an audit event
 */
const logAuditEvent = async ({
  userId = null,
  userEmail = null,
  userName = null,
  action,
  description,
  category = null,
  ipAddress = null,
  userAgent = null,
  metadata = {},
  severity = null,
  status = "success",
}) => {
  try {
    const auditEntry = await AuditLog.logEvent({
      userId,
      userEmail,
      userName,
      action,
      description,
      category: category || ACTION_CATEGORIES[action] || "system",
      ipAddress,
      userAgent,
      metadata,
      severity: severity || getSeverity(action),
      status,
    });
    return auditEntry;
  } catch (error) {
    console.error("Failed to log audit event:", error);
    return null;
  }
};

/**
 * Create Express middleware for automatic audit logging
 */
const createAuditLoggerMiddleware = () => {
  // Define routes to track
  const routeActions = {
    // Auth routes
    "POST /api/auth/login": {
      action: "USER_LOGIN",
      description: "User logged in",
    },
    "POST /api/auth/logout": {
      action: "USER_LOGOUT",
      description: "User logged out",
    },
    "POST /api/auth/guest": {
      action: "GUEST_LOGIN",
      description: "Guest user logged in",
    },

    // Form routes
    "POST /api/forms": {
      action: "FORM_CREATE",
      description: "Created new form",
    },
    "PUT /api/forms": { action: "FORM_UPDATE", description: "Updated form" },
    "DELETE /api/forms": { action: "FORM_DELETE", description: "Deleted form" },
    "POST /api/forms/publish": {
      action: "FORM_PUBLISH",
      description: "Published form",
    },

    // Evaluation routes
    "POST /api/forms/submit": {
      action: "EVALUATION_SUBMIT",
      description: "Submitted evaluation",
    },

    // Certificate routes
    "POST /api/certificates": {
      action: "CERTIFICATE_CREATE",
      description: "Created certificate",
    },
    "DELETE /api/certificates": {
      action: "CERTIFICATE_DELETE",
      description: "Deleted certificate",
    },

    // Report routes
    "POST /api/reports/share": {
      action: "REPORT_SHARE",
      description: "Shared report",
    },

    // User management routes
    "POST /api/users": {
      action: "USER_CREATE",
      description: "Created new user",
    },
    "PUT /api/users": { action: "USER_UPDATE", description: "Updated user" },
    "DELETE /api/users": { action: "USER_DELETE", description: "Deleted user" },

    // Settings routes
    "PUT /api/settings": {
      action: "SETTINGS_UPDATE",
      description: "Updated settings",
    },
  };

  return async (req, res, next) => {
    // Store original end function
    const originalEnd = res.end;

    // Override end to capture response
    res.end = function (...args) {
      // Only log successful mutations (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Build route key
        const routeKey = `${req.method} ${req.baseUrl}${req.route?.path || ""}`;

        // Check for exact match first
        let actionConfig = routeActions[routeKey];

        // If no exact match, try pattern matching
        if (!actionConfig) {
          for (const [pattern, config] of Object.entries(routeActions)) {
            const [method, path] = pattern.split(" ");
            if (
              req.method === method &&
              req.path.startsWith(path.replace("/api", ""))
            ) {
              actionConfig = config;
              break;
            }
          }
        }

        if (actionConfig && req.user) {
          logAuditEvent({
            userId: req.user.id || req.user._id,
            userEmail: req.user.email,
            userName: req.user.name,
            action: actionConfig.action,
            description: actionConfig.description,
            ipAddress: req.ip || req.connection?.remoteAddress,
            userAgent: req.get("User-Agent"),
            metadata: {
              method: req.method,
              path: req.path,
              params: req.params,
              // Don't log sensitive body data
              bodyKeys: Object.keys(req.body || {}),
            },
          }).catch((err) => console.error("Audit log error:", err));
        }
      }

      originalEnd.apply(this, args);
    };

    next();
  };
};

/**
 * Helper to manually log common actions
 */
const AuditActions = {
  userLogin: (user, req) =>
    logAuditEvent({
      userId: user._id,
      userEmail: user.email,
      userName: user.name,
      action: "USER_LOGIN",
      description: `User ${user.email} logged in`,
      ipAddress: req?.ip,
      userAgent: req?.get?.("User-Agent"),
    }),

  userLogout: (user, req) =>
    logAuditEvent({
      userId: user._id,
      userEmail: user.email,
      userName: user.name,
      action: "USER_LOGOUT",
      description: `User ${user.email} logged out`,
      ipAddress: req?.ip,
      userAgent: req?.get?.("User-Agent"),
    }),

  formCreate: (user, formId, formTitle, req) =>
    logAuditEvent({
      userId: user._id,
      userEmail: user.email,
      userName: user.name,
      action: "FORM_CREATE",
      description: `Created form: ${formTitle}`,
      metadata: { targetId: formId, targetType: "Form" },
      ipAddress: req?.ip,
      userAgent: req?.get?.("User-Agent"),
    }),

  formPublish: (user, formId, formTitle, req) =>
    logAuditEvent({
      userId: user._id,
      userEmail: user.email,
      userName: user.name,
      action: "FORM_PUBLISH",
      description: `Published form: ${formTitle}`,
      metadata: { targetId: formId, targetType: "Form" },
      ipAddress: req?.ip,
      userAgent: req?.get?.("User-Agent"),
    }),

  evaluationSubmit: (user, formId, req) =>
    logAuditEvent({
      userId: user._id,
      userEmail: user.email,
      userName: user.name,
      action: "EVALUATION_SUBMIT",
      description: `Submitted evaluation for form`,
      metadata: { targetId: formId, targetType: "Form" },
      ipAddress: req?.ip,
      userAgent: req?.get?.("User-Agent"),
    }),

  certificateDownload: (user, certificateId, req) =>
    logAuditEvent({
      userId: user._id,
      userEmail: user.email,
      userName: user.name,
      action: "CERTIFICATE_DOWNLOAD",
      description: `Downloaded certificate`,
      metadata: { targetId: certificateId, targetType: "Certificate" },
      ipAddress: req?.ip,
      userAgent: req?.get?.("User-Agent"),
    }),

  reportView: (user, reportId, req) =>
    logAuditEvent({
      userId: user._id,
      userEmail: user.email,
      userName: user.name,
      action: "REPORT_VIEW",
      description: `Viewed report`,
      metadata: { targetId: reportId, targetType: "Report" },
      ipAddress: req?.ip,
      userAgent: req?.get?.("User-Agent"),
    }),

  roleChange: (adminUser, targetUser, oldRole, newRole, req) =>
    logAuditEvent({
      userId: adminUser._id,
      userEmail: adminUser.email,
      userName: adminUser.name,
      action: "ROLE_CHANGE",
      description: `Changed role for ${targetUser.email} from ${oldRole} to ${newRole}`,
      metadata: {
        targetId: targetUser._id,
        targetType: "User",
        oldValue: oldRole,
        newValue: newRole,
      },
      ipAddress: req?.ip,
      userAgent: req?.get?.("User-Agent"),
    }),

  settingsUpdate: (user, settingType, req) =>
    logAuditEvent({
      userId: user._id,
      userEmail: user.email,
      userName: user.name,
      action: "SETTINGS_UPDATE",
      description: `Updated ${settingType} settings`,
      metadata: { settingType },
      ipAddress: req?.ip,
      userAgent: req?.get?.("User-Agent"),
    }),

  securityEvent: (eventType, details, req) =>
    logAuditEvent({
      userId: details.userId,
      userEmail: details.userEmail,
      action: eventType,
      description: details.message || `Security event: ${eventType}`,
      category: "security",
      severity: "warning",
      status: "failure",
      ipAddress: details.ip || req?.ip,
      userAgent: details.userAgent || req?.get?.("User-Agent"),
      metadata: details.additionalData,
    }),
};

module.exports = {
  logAuditEvent,
  createAuditLoggerMiddleware,
  AuditActions,
  ACTION_CATEGORIES,
};
