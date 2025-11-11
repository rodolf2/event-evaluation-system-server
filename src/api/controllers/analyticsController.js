const Form = require("../../models/Form");
const AnalysisService = require("../../services/analysis/analysisService");

// GET /api/analytics/form/:formId - Get analytics for a specific form
const getFormAnalytics = async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = req.user._id;

    // Find the form - only creator can view analytics
    const form = await Form.findOne({
      _id: formId,
      createdBy: userId,
    }).populate("createdBy", "name email");

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found or you don't have permission to view its analytics",
      });
    }

    // Calculate total attendees from attendeeList
    const totalAttendees = form.attendeeList ? form.attendeeList.length : 0;
    
    // Calculate total responses
    const totalResponses = form.responses ? form.responses.length : 0;
    
    // Calculate response rate based on actual attendee list
    const responseRate = totalAttendees > 0 ?
      Math.round((totalResponses / totalAttendees) * 100 * 100) / 100 : 0;
    
    // Calculate remaining non-responses - those who haven't responded from the attendee list
    const respondedAttendees = form.attendeeList ?
      form.attendeeList.filter(attendee => attendee.hasResponded).length : 0;
    const remainingNonResponses = totalAttendees - respondedAttendees;

    // Analyze responses for sentiment and breakdown
    const responseAnalysis = AnalysisService.analyzeResponses(form.responses || []);
    
    // Generate response overview time series data
    const responseOverview = AnalysisService.generateResponseOverview(form.responses || []);

    const analyticsData = {
      totalAttendees,
      totalResponses,
      responseRate,
      remainingNonResponses,
      responseBreakdown: {
        positive: {
          percentage: responseAnalysis.sentimentBreakdown.positive.percentage,
          count: responseAnalysis.sentimentBreakdown.positive.count
        },
        neutral: {
          percentage: responseAnalysis.sentimentBreakdown.neutral.percentage,
          count: responseAnalysis.sentimentBreakdown.neutral.count
        },
        negative: {
          percentage: responseAnalysis.sentimentBreakdown.negative.percentage,
          count: responseAnalysis.sentimentBreakdown.negative.count
        }
      },
      responseOverview,
      formInfo: {
        title: form.title,
        description: form.description,
        status: form.status,
        createdAt: form.createdAt,
        publishedAt: form.publishedAt,
        eventStartDate: form.eventStartDate,
        eventEndDate: form.eventEndDate
      }
    };

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
      status: "published"
    }).select("title attendeeList responses createdAt publishedAt eventStartDate eventEndDate");

    const analyticsSummary = forms.map(form => {
      const totalAttendees = form.attendeeList ? form.attendeeList.length : 0;
      const totalResponses = form.responses ? form.responses.length : 0;
      const responseRate = totalAttendees > 0 ? 
        Math.round((totalResponses / totalAttendees) * 100 * 100) / 100 : 0;

      return {
        formId: form._id,
        title: form.title,
        totalAttendees,
        totalResponses,
        responseRate,
        createdAt: form.createdAt,
        publishedAt: form.publishedAt,
        eventStartDate: form.eventStartDate,
        eventEndDate: form.eventEndDate
      };
    });

    res.status(200).json({
      success: true,
      data: {
        forms: analyticsSummary,
        totalForms: forms.length,
        averageResponseRate: analyticsSummary.length > 0 ?
          Math.round(analyticsSummary.reduce((sum, form) => sum + form.responseRate, 0) / analyticsSummary.length * 100) / 100
          : 0
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