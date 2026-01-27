const Form = require("../../models/Form");
const AnalysisService = require("../../services/analysis/analysisService");
const { cache, invalidateCache } = require("../../utils/cache");

// GET /api/analytics/form/:formId - Get analytics for a specific form
const getFormAnalytics = async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = req.user._id;

    // Check if force refresh is requested
    const forceRefresh = req.query.refresh === "true";

    // Check cache first (skip if force refresh)
    const cacheKey = `analytics_form_${formId}`;
    const cachedData = !forceRefresh ? cache.get(cacheKey) : null;
    if (cachedData) {
      console.log(`[ANALYTICS] Cache HIT for form ${formId}`);
      return res.status(200).json({
        success: true,
        data: cachedData,
        cached: true,
      });
    }
    console.log(
      `[ANALYTICS] Cache ${forceRefresh ? "SKIPPED (force refresh)" : "MISS"
      } for form ${formId}`
    );

    // Find the form - only creator can view analytics
    const form = await Form.findOne({
      _id: formId,
      createdBy: userId,
    }).populate("createdBy", "name email");

    if (!form) {
      return res.status(404).json({
        success: false,
        message:
          "Form not found or you don't have permission to view its analytics",
      });
    }

    // Calculate recorded responses from the official attendee list
    const respondedAttendees = form.attendeeList
      ? form.attendeeList.filter((attendee) => attendee.hasResponded).length
      : 0;

    // Calculate total responses received
    const totalResponses = form.responses ? form.responses.length : 0;

    // Guest responses are those that don't match anyone in the attendee list
    // (This works because only people in the attendee list can have hasResponded = true)
    const guestResponses = Math.max(0, totalResponses - respondedAttendees);

    // Initial attendees from CSV/selection
    const initialAttendeesCount = form.attendeeList
      ? form.attendeeList.length
      : 0;

    // Total participants includes both initial attendees and any guests who responded
    const totalAttendees = initialAttendeesCount + guestResponses;

    // Calculate response rate based on the expanded participant pool
    const responseRate =
      totalAttendees > 0
        ? Math.round((totalResponses / totalAttendees) * 100 * 100) / 100
        : 0;

    // Calculate remaining non-responses
    const remainingNonResponses = totalAttendees - totalResponses;

    // Analyze responses for sentiment and breakdown
    let responseAnalysis;
    try {
      // Build question type map for filtering
      const questionTypeMap = {};
      (form.questions || []).forEach((q) => {
        questionTypeMap[q._id.toString()] = q.type;
        questionTypeMap[q.title] = q.type;
      });

      responseAnalysis = await AnalysisService.analyzeResponses(
        form.responses || [],
        true,
        questionTypeMap,
      );
      console.log(
        `[ANALYTICS] Response analysis completed:`,
        responseAnalysis?.sentimentBreakdown
      );

      // Validate the response structure
      if (
        !responseAnalysis ||
        !responseAnalysis.sentimentBreakdown ||
        !responseAnalysis.sentimentBreakdown.positive ||
        !responseAnalysis.sentimentBreakdown.neutral ||
        !responseAnalysis.sentimentBreakdown.negative
      ) {
        console.warn(
          `[ANALYTICS] Invalid response analysis structure, using fallback`
        );
        throw new Error("Invalid analysis response structure");
      }
    } catch (analysisError) {
      console.error(
        `[ANALYTICS] Response analysis failed:`,
        analysisError.message
      );
      // Fallback to empty analysis
      responseAnalysis = {
        sentimentBreakdown: {
          positive: { count: 0, percentage: 0 },
          neutral: { count: 0, percentage: 0 },
          negative: { count: 0, percentage: 0 },
        },
      };
    }

    // Generate response overview time series data
    let responseOverview;
    try {
      responseOverview = AnalysisService.generateResponseOverview(
        form.responses || []
      );
      console.log(
        `[ANALYTICS] Response overview generated: ${responseOverview.labels?.length || 0
        } data points`
      );
    } catch (overviewError) {
      console.error(
        `[ANALYTICS] Response overview generation failed:`,
        overviewError.message
      );
      // Fallback to empty overview
      responseOverview = {
        labels: [],
        data: [],
        dateRange: "No data available",
      };
    }

    // Safe access to sentiment breakdown with defaults
    const sentimentBreakdown = responseAnalysis?.sentimentBreakdown || {};
    const positive = sentimentBreakdown.positive || { percentage: 0, count: 0 };
    const neutral = sentimentBreakdown.neutral || { percentage: 0, count: 0 };
    const negative = sentimentBreakdown.negative || { percentage: 0, count: 0 };

    const analyticsData = {
      totalAttendees,
      totalResponses,
      responseRate,
      remainingNonResponses,
      responseBreakdown: {
        positive: {
          percentage: positive.percentage || 0,
          count: positive.count || 0,
        },
        neutral: {
          percentage: neutral.percentage || 0,
          count: neutral.count || 0,
        },
        negative: {
          percentage: negative.percentage || 0,
          count: negative.count || 0,
        },
      },
      responseOverview,
      formInfo: {
        title: form.title,
        description: form.description,
        status: form.status,
        createdAt: form.createdAt,
        publishedAt: form.publishedAt,
        eventStartDate: form.eventStartDate,
        eventEndDate: form.eventEndDate,
      },
    };

    // Cache the analytics data for 5 minutes (300 seconds)
    cache.set(cacheKey, analyticsData, 300);
    console.log(`[ANALYTICS] Cached analytics for form ${formId}`);

    // Generate/update analytics thumbnail with current data
    try {
      const thumbnailService = require("../../services/thumbnail/thumbnailService");
      await thumbnailService.generateAnalyticsThumbnail(
        formId,
        {
          totalAttendees,
          totalResponses,
          responseRate,
          remainingNonResponses,
          responseBreakdown: analyticsData.responseBreakdown,
        },
        true
      ); // Force regeneration to ensure latest data
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
      "title attendeeList responses createdAt publishedAt eventStartDate eventEndDate"
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
        totalResponsesCount - respondedAttendeesCount
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
                0
              ) /
                analyticsSummary.length) *
              100
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

module.exports = {
  getFormAnalytics,
  getMyFormsAnalytics,
};
