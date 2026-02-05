const cron = require("node-cron");
const FormAnalyticsCache = require("../models/FormAnalyticsCache");
const Form = require("../models/Form");
const AnalyticsCacheService = require("../services/analysis/analyticsCacheService");

/**
 * Analytics Computation Cron Job
 * 
 * Runs every 30 minutes to update analytics cache for forms with:
 * 1. Stale cache (older than 60 minutes)
 * 2. New responses since last analysis
 * 3. No cache at all (new forms)
 */

let isRunning = false;

const runAnalyticsUpdate = async () => {
  if (isRunning) {
    console.log("[ANALYTICS CRON] Previous job still running, skipping...");
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    console.log("[ANALYTICS CRON] ========== Starting Analytics Update ==========");

    // Find all published forms with responses
    const formsWithResponses = await Form.find({
      status: "published",
      "responses.0": { $exists: true }, // Has at least 1 response
    })
      .select("_id responses updatedAt")
      .lean();

    console.log(
      `[ANALYTICS CRON] Found ${formsWithResponses.length} forms with responses`
    );

    if (formsWithResponses.length === 0) {
      console.log("[ANALYTICS CRON] No forms to process");
      isRunning = false;
      return;
    }

    // Get all existing caches
    const existingCaches = await FormAnalyticsCache.find({
      formId: { $in: formsWithResponses.map((f) => f._id) },
    }).lean();

    const cacheMap = new Map();
    existingCaches.forEach((cache) => {
      cacheMap.set(cache.formId.toString(), cache);
    });

    // Determine which forms need updating
    const formsToUpdate = [];
    
    for (const form of formsWithResponses) {
      const formIdStr = form._id.toString();
      const cache = cacheMap.get(formIdStr);

      if (!cache) {
        // No cache exists - needs update
        formsToUpdate.push({
          formId: form._id,
          reason: "no_cache",
          responseCount: form.responses.length,
        });
      } else {
        // Check if cache is stale (older than 60 minutes)
        const cacheAge = Date.now() - new Date(cache.lastAnalyzedAt).getTime();
        const cacheAgeMinutes = cacheAge / (1000 * 60);

        if (cacheAgeMinutes > 60) {
          formsToUpdate.push({
            formId: form._id,
            reason: "stale_cache",
            cacheAge: Math.round(cacheAgeMinutes),
            responseCount: form.responses.length,
          });
        } else if (form.responses.length !== cache.analyzedResponseCount) {
          // Response count changed - new submissions
          formsToUpdate.push({
            formId: form._id,
            reason: "new_responses",
            oldCount: cache.analyzedResponseCount,
            newCount: form.responses.length,
          });
        }
      }
    }

    console.log(
      `[ANALYTICS CRON] ${formsToUpdate.length} forms need updating:`
    );
    formsToUpdate.forEach((item) => {
      console.log(
        `  - Form ${item.formId}: ${item.reason}${
          item.cacheAge ? ` (${item.cacheAge}min old)` : ""
        }${item.oldCount ? ` (${item.oldCount} -> ${item.newCount} responses)` : ""}`
      );
    });

    // Update caches (limit to 1 at a time to avoid overload/freezing)
    const batchSize = 1;
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < formsToUpdate.length; i += batchSize) {
      const batch = formsToUpdate.slice(i, i + batchSize);
      
      console.log(
        `[ANALYTICS CRON] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(formsToUpdate.length / batchSize)}`
      );

      // Process batch in parallel
      const results = await Promise.allSettled(
        batch.map((item) =>
          AnalyticsCacheService.computeAndCacheAnalytics(item.formId)
        )
      );

      results.forEach((result, idx) => {
        if (result.status === "fulfilled") {
          updated++;
          console.log(
            `  ✓ Updated cache for form ${batch[idx].formId} (${result.value.processingTime}ms)`
          );
        } else {
          failed++;
          console.error(
            `  ✗ Failed to update cache for form ${batch[idx].formId}:`,
            result.reason.message
          );
        }
      });
    }

    const totalTime = Date.now() - startTime;

    console.log("[ANALYTICS CRON] ========== Update Complete ==========");
    console.log(`[ANALYTICS CRON] Updated: ${updated} forms`);
    console.log(`[ANALYTICS CRON] Failed: ${failed} forms`);
    console.log(`[ANALYTICS CRON] Total time: ${totalTime}ms`);
    console.log("[ANALYTICS CRON] ==========================================");
  } catch (error) {
    console.error("[ANALYTICS CRON] Error during analytics update:", error);
  } finally {
    isRunning = false;
  }
};

/**
 * Start the analytics computation cron job
 * Runs every 30 minutes: 0 and 30 minutes past the hour
 */
const startAnalyticsCron = () => {
  // Run every 30 minutes
  const schedule = "*/30 * * * *";

  cron.schedule(schedule, runAnalyticsUpdate, {
    scheduled: true,
    timezone: "Asia/Manila", // Adjust to your timezone
  });

  console.log(
    `[ANALYTICS CRON] Scheduled to run every 30 minutes (${schedule})`
  );

  // Optional: Run immediately on startup (useful for development)
  // Comment out in production if you don't want initial run
  setTimeout(() => {
    console.log("[ANALYTICS CRON] Running initial analytics update...");
    runAnalyticsUpdate();
  }, 5000); // Wait 5 seconds after server start
};

/**
 * Manually trigger analytics update (for testing or manual refresh)
 */
const triggerManualUpdate = async (formId = null) => {
  if (formId) {
    console.log(`[ANALYTICS CRON] Manual update triggered for form ${formId}`);
    try {
      await AnalyticsCacheService.computeAndCacheAnalytics(formId);
      console.log(`[ANALYTICS CRON] Manual update completed for form ${formId}`);
    } catch (error) {
      console.error(
        `[ANALYTICS CRON] Manual update failed for form ${formId}:`,
        error
      );
      throw error;
    }
  } else {
    console.log("[ANALYTICS CRON] Manual full update triggered");
    await runAnalyticsUpdate();
  }
};

module.exports = {
  startAnalyticsCron,
  triggerManualUpdate,
  runAnalyticsUpdate,
};
