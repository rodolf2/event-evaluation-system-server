/**
 * Role Demotion Cron Job
 *
 * Runs daily to check for users whose role elevation has expired
 * and demotes them back to their previous role (typically participant).
 */

const cron = require("node-cron");
const User = require("../models/User");

// Configuration
const CRON_SCHEDULE = "0 0 * * *"; // Run at midnight every day
const ROLE_EXPIRATION_ENABLED = process.env.ROLE_EXPIRATION_ENABLED !== "false";

/**
 * Demotes users whose roleExpiresAt date has passed
 */
const demoteExpiredRoles = async () => {
  if (!ROLE_EXPIRATION_ENABLED) {
    console.log("[RoleDemotion] Role expiration is disabled, skipping...");
    return;
  }

  try {
    const now = new Date();
    console.log(
      `[RoleDemotion] Running role expiration check at ${now.toISOString()}`,
    );

    // Find all users with expired roles
    const expiredUsers = await User.find({
      roleExpiresAt: { $lte: now },
      role: "club-officer", // Only demote club-officers for now
    });

    if (expiredUsers.length === 0) {
      console.log("[RoleDemotion] No expired roles found");
      return;
    }

    console.log(
      `[RoleDemotion] Found ${expiredUsers.length} users with expired roles`,
    );

    let demotedCount = 0;
    let errorCount = 0;

    for (const user of expiredUsers) {
      try {
        const previousRole = user.previousRole || "participant";
        const oldRole = user.role;

        // Demote the user
        user.role = previousRole;
        user.roleExpiresAt = null;
        user.previousRole = null;
        user.elevationDate = null;
        user.elevatedBy = null;

        await user.save();

        console.log(
          `[RoleDemotion] Demoted user ${user.email} from ${oldRole} to ${previousRole}`,
        );
        demotedCount++;
      } catch (userError) {
        console.error(
          `[RoleDemotion] Error demoting user ${user.email}:`,
          userError,
        );
        errorCount++;
      }
    }

    console.log(
      `[RoleDemotion] Completed: ${demotedCount} users demoted, ${errorCount} errors`,
    );
  } catch (error) {
    console.error("[RoleDemotion] Critical error in role demotion job:", error);
  }
};

/**
 * Initialize the cron job
 */
const initRoleDemotionCron = () => {
  if (!ROLE_EXPIRATION_ENABLED) {
    console.log("[RoleDemotion] Role expiration cron job is disabled");
    return;
  }

  console.log(
    `[RoleDemotion] Initializing cron job with schedule: ${CRON_SCHEDULE}`,
  );

  cron.schedule(CRON_SCHEDULE, () => {
    demoteExpiredRoles();
  });

  console.log("[RoleDemotion] Cron job initialized successfully");

  // Run immediately on startup to catch any missed demotions
  setTimeout(() => {
    console.log("[RoleDemotion] Running initial check on startup...");
    demoteExpiredRoles();
  }, 5000); // Wait 5 seconds for DB connection to stabilize
};

module.exports = {
  initRoleDemotionCron,
  demoteExpiredRoles,
};
