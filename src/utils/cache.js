const NodeCache = require("node-cache");

// Create a new cache instance with standard TTL
const cache = new NodeCache({
  stdTTL: 300, // 5 minutes default cache time
  checkperiod: 600, // 10 minutes cleanup interval
  useClones: false, // Don't clone objects for performance
});

// Cache frequently accessed forms
const getCachedForm = async (formId, fetchFunction) => {
  const cacheKey = `form_${formId}`;

  // Try to get from cache first
  let form = cache.get(cacheKey);

  if (form) {
    return form;
  }

  // If not in cache, fetch and cache it
  form = await fetchFunction(formId);

  if (form) {
    cache.set(cacheKey, form, 300); // Cache for 5 minutes
  }

  return form;
};

// Cache frequently accessed events
const getCachedEvent = async (eventId, fetchFunction) => {
  const cacheKey = `event_${eventId}`;

  // Try to get from cache first
  let event = cache.get(cacheKey);

  if (event) {
    return event;
  }

  // If not in cache, fetch and cache it
  event = await fetchFunction(eventId);

  if (event) {
    cache.set(cacheKey, event, 600); // Cache for 10 minutes
  }

  return event;
};

// Cache analysis results for reports
const getCachedAnalysis = async (reportId, fetchFunction) => {
  const cacheKey = `analysis_${reportId}`;

  // Try to get from cache first
  let analysis = cache.get(cacheKey);

  if (analysis) {
    return analysis;
  }

  // If not in cache, fetch and cache it
  analysis = await fetchFunction(reportId);

  if (analysis) {
    cache.set(cacheKey, analysis, 1800); // Cache for 30 minutes
  }

  return analysis;
};

// Invalidate cache for specific items
const invalidateCache = (keyPattern) => {
  if (keyPattern) {
    const keys = cache.keys();
    keys.forEach((key) => {
      if (key.includes(keyPattern)) {
        cache.del(key);
      }
    });
  } else {
    // Clear entire cache if no pattern specified
    cache.flushAll();
  }
};

// Get cache statistics
const getCacheStats = () => {
  return {
    keys: cache.keys(),
    hitCount: cache.getStats().hits,
    missCount: cache.getStats().misses,
    itemCount: cache.getStats().keys,
    memoryUsage: process.memoryUsage(),
  };
};

module.exports = {
  getCachedForm,
  getCachedEvent,
  getCachedAnalysis,
  invalidateCache,
  getCacheStats,
  cache, // Export cache instance for direct access if needed
};
