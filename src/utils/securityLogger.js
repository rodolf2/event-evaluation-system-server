/**
 * Security Logger Utility
 * Logs security-related events for monitoring and auditing
 */

const fs = require("fs");
const path = require("path");

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, "../../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const securityLogFile = path.join(logsDir, "security.log");

/**
 * Security event types
 */
const SecurityEventType = {
  RATE_LIMIT_HIT: "RATE_LIMIT_HIT",
  FAILED_LOGIN: "FAILED_LOGIN",
  SUSPICIOUS_REQUEST: "SUSPICIOUS_REQUEST",
  NOSQL_INJECTION_ATTEMPT: "NOSQL_INJECTION_ATTEMPT",
  UNAUTHORIZED_ACCESS: "UNAUTHORIZED_ACCESS",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  INVALID_TOKEN: "INVALID_TOKEN",
  CSRF_VIOLATION: "CSRF_VIOLATION",
};

/**
 * Log a security event
 * @param {string} eventType - Type of security event
 * @param {object} details - Event details
 */
const logSecurityEvent = (eventType, details = {}) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    eventType,
    ip: details.ip || "unknown",
    userId: details.userId || null,
    userEmail: details.userEmail || null,
    path: details.path || null,
    method: details.method || null,
    userAgent: details.userAgent || null,
    message: details.message || null,
    additionalData: details.additionalData || null,
  };

  // Console log for immediate visibility
  const logLevel = getLogLevel(eventType);
  const emoji = getLogEmoji(eventType);
  console.log(
    `${emoji} [SECURITY ${logLevel}] ${eventType}: ${
      details.message || "No message"
    } | IP: ${logEntry.ip}`
  );

  // Write to file for audit trail
  const logLine = JSON.stringify(logEntry) + "\n";
  fs.appendFile(securityLogFile, logLine, (err) => {
    if (err) {
      console.error("Failed to write security log:", err);
    }
  });

  // Also persist to AuditLog database for MIS viewing
  setImmediate(async () => {
    try {
      const AuditLog = require("../models/AuditLog");
      await AuditLog.logEvent({
        userId: details.userId || null,
        userEmail: details.userEmail || null,
        action: eventType,
        category: "security",
        description: details.message || `Security event: ${eventType}`,
        ipAddress: details.ip,
        userAgent: details.userAgent,
        severity:
          logLevel === "CRITICAL"
            ? "critical"
            : logLevel === "WARNING"
            ? "warning"
            : "info",
        status: "failure",
        metadata: {
          path: details.path,
          method: details.method,
          additionalData: details.additionalData,
        },
      });
    } catch (err) {
      // Silently fail if AuditLog model is not available yet
      if (!err.message?.includes("Cannot find module")) {
        console.error(
          "Failed to persist security event to AuditLog:",
          err.message
        );
      }
    }
  });

  return logEntry;
};

/**
 * Get log level based on event type
 */
const getLogLevel = (eventType) => {
  const criticalEvents = [
    SecurityEventType.NOSQL_INJECTION_ATTEMPT,
    SecurityEventType.CSRF_VIOLATION,
  ];
  const warningEvents = [
    SecurityEventType.RATE_LIMIT_HIT,
    SecurityEventType.FAILED_LOGIN,
    SecurityEventType.UNAUTHORIZED_ACCESS,
  ];

  if (criticalEvents.includes(eventType)) return "CRITICAL";
  if (warningEvents.includes(eventType)) return "WARNING";
  return "INFO";
};

/**
 * Get emoji for log visibility
 */
const getLogEmoji = (eventType) => {
  const emojiMap = {
    [SecurityEventType.RATE_LIMIT_HIT]: "🚫",
    [SecurityEventType.FAILED_LOGIN]: "🔐",
    [SecurityEventType.SUSPICIOUS_REQUEST]: "🔍",
    [SecurityEventType.NOSQL_INJECTION_ATTEMPT]: "⚠️",
    [SecurityEventType.UNAUTHORIZED_ACCESS]: "🚨",
    [SecurityEventType.TOKEN_EXPIRED]: "⏰",
    [SecurityEventType.INVALID_TOKEN]: "❌",
    [SecurityEventType.CSRF_VIOLATION]: "🛡️",
  };
  return emojiMap[eventType] || "📋";
};

/**
 * Create Express middleware for logging requests from blocked IPs
 */
const createSecurityLoggerMiddleware = () => {
  return (req, res, next) => {
    // Store original end function
    const originalEnd = res.end;

    // Override end to capture response
    res.end = function (...args) {
      // Log failed authentication attempts
      if (res.statusCode === 401 && req.path.includes("/auth")) {
        logSecurityEvent(SecurityEventType.FAILED_LOGIN, {
          ip: req.ip || req.connection.remoteAddress,
          path: req.path,
          method: req.method,
          userAgent: req.get("User-Agent"),
          message: "Failed authentication attempt",
        });
      }

      // Log unauthorized access
      if (res.statusCode === 403) {
        logSecurityEvent(SecurityEventType.UNAUTHORIZED_ACCESS, {
          ip: req.ip || req.connection.remoteAddress,
          path: req.path,
          method: req.method,
          userAgent: req.get("User-Agent"),
          userId: req.user?.id,
          message: "Forbidden access attempt",
        });
      }

      originalEnd.apply(this, args);
    };

    next();
  };
};

module.exports = {
  SecurityEventType,
  logSecurityEvent,
  createSecurityLoggerMiddleware,
};
