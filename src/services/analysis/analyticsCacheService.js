const FormAnalyticsCache = require("../../models/FormAnalyticsCache");
const Form = require("../../models/Form");
const AnalysisService = require("./analysisService");

/**
 * Analytics Cache Service
 * 
 * Manages the analytics cache lifecycle:
 * - Retrieval from cache
 * - Cache updates
 * - Staleness checks
 */

class AnalyticsCacheService {
  /**
   * Get analytics from cache or compute if missing/stale
   * @param {String} formId - Form ID
   * @param {Object} options - Options for cache retrieval
   * @param {Boolean} options.forceRefresh - Force recomputation
   * @param {Number} options.maxAgeMinutes - Max cache age (default: 60)
   * @returns {Object} Analytics data with metadata
   */
  static async getOrComputeAnalytics(formId, options = {}) {
    const { forceRefresh = false, maxAgeMinutes = 60 } = options;

    try {
      // 1. Try to get cache FIRST (exclude heavy comments array for speed)
      const cachedAnalytics = await FormAnalyticsCache.findOne({ formId })
        .select("-categorizedComments")
        .lean();

      if (cachedAnalytics) {
        // Calculate age manually since we used lean()
        const now = new Date();
        const lastAnalyzed = new Date(cachedAnalytics.lastAnalyzedAt);
        const ageMs = now - lastAnalyzed;
        const ageMinutes = Math.round(ageMs / (1000 * 60));
        const isStale = ageMinutes > maxAgeMinutes;

        // If force refresh OR stale -> Trigger background update (FIRE AND FORGET)
        if (forceRefresh || isStale) {
          console.log(
            `[ANALYTICS CACHE] ${
              forceRefresh ? "FORCE REFRESH" : "STALE"
            } - triggering background update for ${formId}`
          );

          // Non-blocking background update
          this.computeAndCacheAnalytics(formId).catch((err) =>
            console.error(
              `[ANALYTICS CACHE] Background update failed for ${formId}:`,
              err
            )
          );
        } else {
          console.log(
            `[ANALYTICS CACHE] HIT for form ${formId} (age: ${ageMinutes}min)`
          );
        }

        // Return cached data IMMEDIATELY
        return {
          ...cachedAnalytics,
          cached: true,
          cacheAge: ageMinutes,
        };
      }

      console.log(`[ANALYTICS CACHE] MISS for form ${formId} - computing now`);

      // 2. If no cache, we MUST compute (blocking)
      const computed = await this.computeAndCacheAnalytics(formId);
      
      // Strip comments from result to match lean behavior
      const { categorizedComments, ...leanComputed } = computed;
      return leanComputed;
    } catch (error) {
      console.error(`[ANALYTICS CACHE] Error for form ${formId}:`, error);
      throw error;
    }
  }

  /**
   * Compute analytics and store in cache
   * @param {String} formId - Form ID
   * @returns {Object} Computed analytics data
   */
  static async computeAndCacheAnalytics(formId) {
    const startTime = Date.now();

    try {
      // Fetch form with necessary data
      const form = await Form.findOne({ _id: formId })
        .lean()
        .select(
          "_id attendeeList responses questions publishedAt eventStartDate eventEndDate"
        );

      if (!form) {
        throw new Error(`Form ${formId} not found`);
      }

      // Calculate basic metrics
      const uniqueInvitedRespondents = form.attendeeList
        ? form.attendeeList.filter((attendee) => attendee.hasResponded).length
        : 0;

      const totalSubmissions = form.responses ? form.responses.length : 0;
      const initialAttendeesCount = form.attendeeList
        ? form.attendeeList.length
        : 0;

      let guestResponses = 0;
      if (initialAttendeesCount > 0) {
        guestResponses = Math.max(0, totalSubmissions - uniqueInvitedRespondents);
      } else {
        guestResponses = totalSubmissions;
      }

      const totalAttendees =
        initialAttendeesCount + (initialAttendeesCount > 0 ? guestResponses : 0);
      const totalResponses = totalSubmissions;

      const responseRate =
        totalAttendees > 0
          ? Math.round((totalResponses / totalAttendees) * 100 * 100) / 100
          : 0;

      const remainingNonResponses = Math.max(
        0,
        initialAttendeesCount - uniqueInvitedRespondents
      );

      // Build question type map
      const questionTypeMap = {};
      (form.questions || []).forEach((q) => {
        questionTypeMap[q._id.toString()] = q.type;
        questionTypeMap[q.title] = q.type;
      });

      // Analyze responses for sentiment
      let responseAnalysis;
      try {
        responseAnalysis = await AnalysisService.analyzeResponses(
          form.responses || [],
          questionTypeMap,
          form.questions || []
        );

        console.log(
          `[ANALYTICS CACHE] Analysis completed for form ${formId}:`,
          responseAnalysis?.sentimentBreakdown
        );
      } catch (analysisError) {
        console.error(
          `[ANALYTICS CACHE] Analysis failed for form ${formId}:`,
          analysisError.message
        );
        // Use fallback empty structure
        responseAnalysis = {
          sentimentBreakdown: {
            positive: { count: 0, percentage: 0 },
            neutral: { count: 0, percentage: 0 },
            negative: { count: 0, percentage: 0 },
          },
          categorizedComments: {
            positive: [],
            neutral: [],
            negative: [],
          },
          questionBreakdown: [],
          method: "fallback_empty",
        };
      }

      // Generate response overview
      let responseOverview;
      try {
        responseOverview = AnalysisService.generateResponseOverview(
          form.responses || []
        );
      } catch (overviewError) {
        console.error(
          `[ANALYTICS CACHE] Overview generation failed:`,
          overviewError.message
        );
        responseOverview = {
          labels: [],
          data: [],
          dateRange: "No data available",
        };
      }

      const processingTime = Date.now() - startTime;

      // Prepare cache data
      const cacheData = {
        formId,
        lastAnalyzedAt: new Date(),
        totalResponses,
        totalAttendees,
        responseRate,
        remainingNonResponses,
        sentimentBreakdown: {
          positive: {
            count: responseAnalysis.sentimentBreakdown?.positive?.count || 0,
            percentage:
              responseAnalysis.sentimentBreakdown?.positive?.percentage || 0,
          },
          neutral: {
            count: responseAnalysis.sentimentBreakdown?.neutral?.count || 0,
            percentage:
              responseAnalysis.sentimentBreakdown?.neutral?.percentage || 0,
          },
          negative: {
            count: responseAnalysis.sentimentBreakdown?.negative?.count || 0,
            percentage:
              responseAnalysis.sentimentBreakdown?.negative?.percentage || 0,
          },
        },
        categorizedComments: responseAnalysis.categorizedComments || {
          positive: [],
          neutral: [],
          negative: [],
        },
        questionBreakdown: responseAnalysis.questionBreakdown || [],
        responseOverview,
        analysisMethod: responseAnalysis.method || "unknown",
        processingTime,
        analyzedResponseCount: totalSubmissions,
      };

      // Upsert cache
      const updatedCache = await FormAnalyticsCache.findOneAndUpdate(
        { formId },
        cacheData,
        { upsert: true, new: true }
      );

      console.log(
        `[ANALYTICS CACHE] Updated cache for form ${formId} (${processingTime}ms, ${totalSubmissions} responses)`
      );

      return {
        ...updatedCache.toObject(),
        cached: false,
        cacheAge: 0,
      };
    } catch (error) {
      console.error(
        `[ANALYTICS CACHE] Failed to compute analytics for form ${formId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get paginated comments from cache
   * @param {String} formId - Form ID
   * @param {String} sentiment - Sentiment filter (positive/neutral/negative/all)
   * @param {Number} page - Page number (1-indexed)
   * @param {Number} limit - Items per page
   * @returns {Object} Paginated comments with metadata
   */
  static async getPaginatedComments(formId, sentiment = "all", page = 1, limit = 50) {
    try {
      const cache = await FormAnalyticsCache.findOne({ formId });

      if (!cache) {
        // If no cache, return empty result
        return {
          comments: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
          hasMore: false,
        };
      }

      let allComments = [];
      
      if (sentiment === "all") {
        allComments = [
          ...(cache.categorizedComments.positive || []),
          ...(cache.categorizedComments.neutral || []),
          ...(cache.categorizedComments.negative || []),
        ];
      } else {
        allComments = cache.categorizedComments[sentiment] || [];
      }

      const total = allComments.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const comments = allComments.slice(startIndex, endIndex);

      return {
        comments,
        total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages,
        lastUpdated: cache.lastAnalyzedAt,
      };
    } catch (error) {
      console.error(
        `[ANALYTICS CACHE] Error getting paginated comments for form ${formId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Invalidate cache for a specific form
   * @param {String} formId - Form ID
   */
  static async invalidateCache(formId) {
    try {
      await FormAnalyticsCache.deleteOne({ formId });
      console.log(`[ANALYTICS CACHE] Invalidated cache for form ${formId}`);
    } catch (error) {
      console.error(
        `[ANALYTICS CACHE] Error invalidating cache for form ${formId}:`,
        error
      );
    }
  }

  /**
   * Find all stale caches
   * @param {Number} maxAgeMinutes - Maximum age threshold
   * @returns {Array} Array of formIds with stale caches
   */
  static async findStaleCaches(maxAgeMinutes = 60) {
    try {
      const threshold = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
      const staleCaches = await FormAnalyticsCache.find({
        lastAnalyzedAt: { $lt: threshold },
      }).select("formId lastAnalyzedAt");

      return staleCaches.map((cache) => ({
        formId: cache.formId,
        lastAnalyzedAt: cache.lastAnalyzedAt,
        ageMinutes: cache.getAgeMinutes(),
      }));
    } catch (error) {
      console.error("[ANALYTICS CACHE] Error finding stale caches:", error);
      return [];
    }
  }
}

module.exports = AnalyticsCacheService;
