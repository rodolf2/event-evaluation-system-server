const Form = require("../../models/Form");
const AnalysisService = require("../../services/analysis/analysisService");
const { cache, invalidateCache } = require("../../utils/cache");
const AnalyticsCacheService = require("../../services/analysis/analyticsCacheService");

/**
 * OPTIMIZATION: Sample responses for analysis
 * When datasets are large (>100 responses), use stratified sampling
 * to maintain statistical accuracy while improving performance
 * @param {Array} responses - All responses
 * @param {Number} sampleSize - Desired sample size
 * @returns {Array} Sampled responses
 */
function sampleResponses(responses, sampleSize) {
  if (!responses || responses.length <= sampleSize) {
    return responses;
  }

  // Stratified sampling: maintain distribution of sentiments if possible
  const sampled = [];
  const step = Math.floor(responses.length / sampleSize);

  for (let i = 0; i < responses.length; i += step) {
    if (sampled.length < sampleSize) {
      sampled.push(responses[i]);
    }
  }

  return sampled;
}

// GET /api/analytics/form/:formId - Get analytics for a specific form
const getFormAnalytics = async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = req.user._id;

    // Check if force refresh is requested
    const forceRefresh = req.query.refresh === "true";

    // PERFORMANCE OPTIMIZATION: Use cache service
    // This retrieves pre-computed analytics from the cache if available
    // Otherwise, it computes the analytics and stores them in the cache
    let analyticsData;
    try {
      const cacheResult = await AnalyticsCacheService.getOrComputeAnalytics(
        formId,
        { forceRefresh, maxAgeMinutes: 60 }
      );

      // Extract the data we need for the response
      analyticsData = {
        totalAttendees: cacheResult.totalAttendees,
        totalResponses: cacheResult.totalResponses,
        responseRate: cacheResult.responseRate,
        remainingNonResponses: cacheResult.remainingNonResponses,
        responseBreakdown: {
          positive: {
            percentage: cacheResult.sentimentBreakdown.positive.percentage,
            count: cacheResult.sentimentBreakdown.positive.count,
          },
          neutral: {
            percentage: cacheResult.sentimentBreakdown.neutral.percentage,
            count: cacheResult.sentimentBreakdown.neutral.count,
          },
          negative: {
            percentage: cacheResult.sentimentBreakdown.negative.percentage,
            count: cacheResult.sentimentBreakdown.negative.count,
          },
        },
        categorizedComments: cacheResult.categorizedComments,
        analyzedResponses: [], // Deprecated, kept for backward compatibility
        questionBreakdown: cacheResult.questionBreakdown,
        responseOverview: cacheResult.responseOverview,
        // Metadata about cache
        lastUpdated: cacheResult.lastAnalyzedAt,
        cached: cacheResult.cached,
        cacheAge: cacheResult.cacheAge,
        processingTime: cacheResult.processingTime,
      };

      // Get form info for the response
      const form = await Form.findOne({ _id: formId })
        .lean()
        .select(
          "_id title description status createdAt publishedAt eventStartDate eventEndDate createdBy"
        )
        .populate({
          path: "createdBy",
          select: "name email",
          options: { lean: true },
        });

      if (!form) {
        return res.status(404).json({
          success: false,
          message: "Form not found",
        });
      }

      // Permission check
      const isCreator =
        form.createdBy && form.createdBy._id.toString() === userId.toString();
      const isAuthorizedRole = [
        "psas",
        "senior-management",
        "mis",
        "school-admin",
        "club-officer",
      ].includes(req.user.role);

      if (!isCreator && !isAuthorizedRole) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to view this form's analytics",
        });
      }

      // Add form info to analytics data
      analyticsData.formInfo = {
        title: form.title,
        description: form.description,
        status: form.status,
        createdAt: form.createdAt,
        publishedAt: form.publishedAt,
        eventStartDate: form.eventStartDate,
        eventEndDate: form.eventEndDate,
      };

      // Generate/update analytics thumbnail with current data
      try {
        const thumbnailService = require("../../services/thumbnail/thumbnailService");
        await thumbnailService.generateAnalyticsThumbnail(
          formId,
          {
            totalAttendees: analyticsData.totalAttendees,
            totalResponses: analyticsData.totalResponses,
            responseRate: analyticsData.responseRate,
            remainingNonResponses: analyticsData.remainingNonResponses,
            responseBreakdown: analyticsData.responseBreakdown,
          },
          forceRefresh
        );
        console.log(`✅ Analytics thumbnail generated for form ${formId}`);
      } catch (thumbnailError) {
        console.error(
          `⚠️ Failed to generate analytics thumbnail:`,
          thumbnailError.message
        );
        // Continue even if thumbnail generation fails
      }

      res.status(200).json({
        success: true,
        data: analyticsData,
      });
    } catch (cacheError) {
      console.error("[ANALYTICS] Cache service error:", cacheError);
      // Fallback to empty data if cache fails
      return res.status(500).json({
        success: false,
        message: "Failed to fetch analytics data",
        error: cacheError.message,
      });
    }
  } catch (error) {
    console.error("Error fetching form analytics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch form analytics",
      error: error.message,
    });
  }
};

// GET /api/analytics/my-forms - Get analytics summary for all user's forms
const getMyFormsAnalytics = async (req, res) => {
  try {
    const userId = req.user._id;

    const forms = await Form.find({
      createdBy: userId,
      status: "published",
    }).select(
      "title attendeeList responses createdAt publishedAt eventStartDate eventEndDate",
    );

    const analyticsSummary = forms.map((form) => {
      // Calculate recorded responses from the official attendee list
      const respondedAttendeesCount = form.attendeeList
        ? form.attendeeList.filter((attendee) => attendee.hasResponded).length
        : 0;

      // Calculate total responses received
      const totalResponsesCount = form.responses ? form.responses.length : 0;

      // Guest responses are those that don't match anyone in the attendee list
      const guestResponsesCount = Math.max(
        0,
        totalResponsesCount - respondedAttendeesCount,
      );

      // Initial attendees from CSV/selection
      const initialAttendeesCount = form.attendeeList
        ? form.attendeeList.length
        : 0;

      // Total participants includes both initial attendees and any guests who responded
      const totalAttendees = initialAttendeesCount + guestResponsesCount;
      const totalResponses = totalResponsesCount;

      const responseRate =
        totalAttendees > 0
          ? Math.round((totalResponses / totalAttendees) * 100 * 100) / 100
          : 0;

      return {
        formId: form._id,
        title: form.title,
        totalAttendees,
        totalResponses,
        responseRate,
        createdAt: form.createdAt,
        publishedAt: form.publishedAt,
        eventStartDate: form.eventStartDate,
        eventEndDate: form.eventEndDate,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        forms: analyticsSummary,
        totalForms: forms.length,
        averageResponseRate:
          analyticsSummary.length > 0
            ? Math.round(
                (analyticsSummary.reduce(
                  (sum, form) => sum + form.responseRate,
                  0,
                ) /
                  analyticsSummary.length) *
                  100,
              ) / 100
            : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching forms analytics summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch forms analytics summary",
      error: error.message,
    });
  }
};

// POST /api/analytics/form/:formId/refresh - Manually refresh analytics cache
const refreshFormAnalytics = async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = req.user._id;

    // Check if form exists and user has permission
    const form = await Form.findOne({ _id: formId })
      .lean()
      .select("_id createdBy")
      .populate({
        path: "createdBy",
        select: "_id",
        options: { lean: true },
      });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    // Permission check
    const isCreator =
      form.createdBy && form.createdBy._id.toString() === userId.toString();
    const isAuthorizedRole = [
      "psas",
      "senior-management",
      "mis",
      "school-admin",
      "club-officer",
    ].includes(req.user.role);

    if (!isCreator && !isAuthorizedRole) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to refresh this form's analytics",
      });
    }

    // Trigger manual refresh
    const { triggerManualUpdate } = require("../../jobs/analyticsComputationCron");
    await triggerManualUpdate(formId);

    res.status(200).json({
      success: true,
      message: "Analytics refresh triggered successfully",
    });
  } catch (error) {
    console.error("Error refreshing form analytics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to refresh analytics",
      error: error.message,
    });
  }
};

// GET /api/analytics/form/:formId/comments - Get paginated comments
const getFormCommentsPaginated = async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = req.user._id;
    const { sentiment = "all", page = 1, limit = 50 } = req.query;

    // Check if form exists and user has permission
    const form = await Form.findOne({ _id: formId })
      .lean()
      .select("_id createdBy")
      .populate({
        path: "createdBy",
        select: "_id",
        options: { lean: true },
      });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    // Permission check
    const isCreator =
      form.createdBy && form.createdBy._id.toString() === userId.toString();
    const isAuthorizedRole = [
      "psas",
      "senior-management",
      "mis",
      "school-admin",
      "club-officer",
    ].includes(req.user.role);

    if (!isCreator && !isAuthorizedRole) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to view this form's comments",
      });
    }

    // Get paginated comments from cache
    const paginatedData = await AnalyticsCacheService.getPaginatedComments(
      formId,
      sentiment,
      parseInt(page),
      parseInt(limit)
    );

    res.status(200).json({
      success: true,
      data: paginatedData,
    });
  } catch (error) {
    console.error("Error fetching paginated comments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch comments",
      error: error.message,
    });
  }
};

module.exports = {
  getFormAnalytics,
  getMyFormsAnalytics,
  refreshFormAnalytics,
  getFormCommentsPaginated,
};
