const Form = require("../../models/Form");
const Report = require("../../models/Report");
const SystemSettings = require("../../models/SystemSettings");
const User = require("../../models/User");

const AnalysisService = require("../../services/analysis/analysisService");
const ThumbnailService = require("../../services/thumbnail/thumbnailService");
const DynamicCSVReportService = require("../../services/reports/dynamicCSVReportService");
const SharedReport = require("../../models/SharedReport");
const mongoose = require("mongoose");
const { cache, invalidateCache } = require("../../utils/cache");
const { emitUpdate } = require("../../utils/socket");

/**
 * Helper to check if a user has access to a shared report
 */
const checkSharedReportAccess = async (reportId, user) => {
  // PSAS, MIS, and Club Officers always have access (they create/manage reports)
  if (
    user.role === "psas" ||
    user.role === "mis" ||
    user.role === "club-officer"
  ) {
    return true;
  }

  // For other roles, check if shared and not expired
  // Use case-insensitive email matching
  const userEmailLower = user.email?.toLowerCase();
  const sharedReport = await SharedReport.findOne({
    reportId,
  });

  if (!sharedReport) return false;

  // Check if user's email is in the sharedWith list (case-insensitive)
  const isSharedWithUser = sharedReport.sharedWith.some(
    (recipient) => recipient.email?.toLowerCase() === userEmailLower,
  );

  if (!isSharedWithUser) return false;

  // Check expiration
  if (sharedReport.expiresAt && new Date(sharedReport.expiresAt) < new Date()) {
    return false;
  }

  return true;
};

/**
 * Helper to find the previous year's form for the same event
 */
const findPreviousYearForm = async (currentForm) => {
  try {
    const currentYear = new Date(currentForm.createdAt).getFullYear();
    const targetYear = currentYear - 1;

    // 1. Clean the title: 
    // - Remove 4-digit year (e.g., "Gala 2024" -> "Gala")
    // - Remove ordinal prefixes (e.g., "1st", "2nd", "3rd", "4th", "10th", "21st")
    // - Trim and escape special regex characters
    const cleanTitle = currentForm.title
      .replace(/\b\d{4}\b/g, "") // Remove year
      .replace(/\b\d+(?:st|nd|rd|th)\b/gi, "") // Remove ordinals
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .trim();

    if (!cleanTitle) return null;

    // 2. Search for forms in the previous year with a matching title
    const startDate = new Date(targetYear, 0, 1);
    const endDate = new Date(targetYear, 11, 31, 23, 59, 59);

    console.log(`[LINKING] Searching for previous event:`);
    console.log(`- Base Title: "${cleanTitle}"`);
    console.log(`- Target Year: ${targetYear} (${startDate.toISOString()} - ${endDate.toISOString()})`);

    const previousForms = await Form.find({
      status: { $in: ["published", "closed"] }, // Include closed forms
      title: { $regex: cleanTitle, $options: "i" }, // Case-insensitive match
      createdAt: { $gte: startDate, $lte: endDate },
      _id: { $ne: currentForm._id }, // Exclude self (just in case)
    }).sort({ createdAt: -1 }); // Get the latest one from that year

    console.log(`[LINKING] Found ${previousForms.length} matches.`);
    if (previousForms.length > 0) {
       console.log(`[LINKING] Match: "${previousForms[0].title}" (${previousForms[0]._id})`);
    }

    if (previousForms.length === 0) return null;

    // Return the best match (first one)
    return previousForms[0];
  } catch (error) {
    console.error("Error finding previous year form:", error);
    return null;
  }
};

/**
 * Get dynamic quantitative data with filtering and date range
 */
const getDynamicQuantitativeData = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { startDate, endDate, ratingFilter, responseLimit, useSnapshot } =
      req.query;

    const userId = req.user._id;

    // Check shared access if necessary
    const hasAccess = await checkSharedReportAccess(reportId, req.user);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to view this report or it has expired",
      });
    }

    // Find the form
    const form = await Form.findById(reportId).populate(
      "createdBy",
      "name email role",
    );
    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    // Check if we should use snapshot data (for generated reports)
    if (useSnapshot === "true") {
      const report = await Report.findOne({ formId: reportId, userId });
      if (report && report.dataSnapshot) {
        // Return frozen snapshot data
        const snapshot = report.dataSnapshot;

        // Apply filters to snapshot data if needed
        let responses = snapshot.responses || [];
        let scaleResponses = snapshot.scaleResponses || [];

        // Date range filter
        if (startDate || endDate) {
          responses = responses.filter((response) => {
            const submittedAt = new Date(response.submittedAt);
            if (startDate && submittedAt < new Date(startDate)) return false;
            if (endDate && submittedAt > new Date(endDate)) return false;
            return true;
          });
          scaleResponses = scaleResponses.filter((response) => {
            const submittedAt = new Date(response.submittedAt);
            if (startDate && submittedAt < new Date(startDate)) return false;
            if (endDate && submittedAt > new Date(endDate)) return false;
            return true;
          });
        }

        // Apply rating filter
        let filteredScaleResponses = scaleResponses;
        if (ratingFilter) {
          const [min, max] = ratingFilter.split("-").map(Number);
          if (!isNaN(min) && !isNaN(max)) {
            filteredScaleResponses = scaleResponses.filter(
              (r) => r.value >= min && r.value <= max,
            );
          }
        }

        return res.status(200).json({
          success: true,
          data: {
            metrics: snapshot.analytics.quantitativeData,
            charts: snapshot.analytics.charts,
            rawData: filteredScaleResponses,
            formInfo: {
              title: form.title,
              description: form.description,
              status: form.status,
              eventStartDate: form.eventStartDate,
              eventEndDate: form.eventEndDate,
              publishedAt: form.publishedAt,
            },
            filters: {
              startDate,
              endDate,
              ratingFilter,
              responseLimit,
            },
            isSnapshot: true,
            snapshotDate: snapshot.snapshotDate,
            lastUpdated: snapshot.snapshotDate,
          },
        });
      }
    }

    // No snapshot or useSnapshot=false - return live data
    // Build dynamic filter for responses
    let responses = form.responses || [];

    // Date range filter
    if (startDate || endDate) {
      responses = responses.filter((response) => {
        const submittedAt = new Date(response.submittedAt);
        if (startDate && submittedAt < new Date(startDate)) return false;
        if (endDate && submittedAt > new Date(endDate)) return false;
        return true;
      });
    }

    // Extract scale/rating responses for analysis
    const scaleResponses = extractScaleResponses(responses);

    // Apply rating filter if specified
    let filteredScaleResponses = scaleResponses;
    if (ratingFilter) {
      const [min, max] = ratingFilter.split("-").map(Number);
      if (!isNaN(min) && !isNaN(max)) {
        filteredScaleResponses = scaleResponses.filter(
          (r) => r.value >= min && r.value <= max,
        );
      }
    }

    // Process data for charts
    const yearData = processYearlyDataFromForm(form, responses);
    const ratingDistribution = processRatingDistributionFromForm(
      filteredScaleResponses,
    );
    const statusBreakdown = processStatusBreakdownFromForm(form);
    const responseTrends = processResponseTrendsFromForm(responses);

    // --- NEW: Fetch Previous Year Data for Breakdown ---
    let previousForm = null;
    let previousResponses = [];
    try {
      previousForm = await findPreviousYearForm(form);
      if (previousForm) {
        previousResponses = previousForm.responses || [];
      }
    } catch (err) {
      console.error("[LINKING] Error fetching previous form for breakdown:", err);
    }

    // --- NEW: Augment Attendee List for Missing Users ---
    // Some respondents (e.g. Basic Ed students) might not be in the original attendee list
    // We fetch their User details to get department/yearLevel info
    let augmentedForm = form;
    try {
      const existingEmails = new Set((form.attendeeList || []).map(a => a.email?.toLowerCase()).filter(Boolean));
      const missingEmails = responses
        .map(r => r.respondentEmail?.toLowerCase())
        .filter(email => email && !existingEmails.has(email));
      
      if (missingEmails.length > 0) {
        // Fetch users for these emails
        const foundUsers = await User.find({ email: { $in: missingEmails } }).select('email name department yearLevel role');
        
        if (foundUsers.length > 0) {
          const extraAttendees = foundUsers.map(u => ({
            email: u.email,
            department: u.department,
            yearLevel: u.yearLevel,
            name: u.name,
            role: u.role
          }));
          
          // Create a plain object copy of form with augmented attendee list
          // mapping to ensure we don't mutate the original mongoose doc if it's being tracked
          const plainForm = form.toObject ? form.toObject() : { ...form };
          plainForm.attendeeList = [...(plainForm.attendeeList || []), ...extraAttendees];
          augmentedForm = plainForm;
          console.log(`[REPORT] Augmented attendee list with ${extraAttendees.length} users for breakdown.`);
        }
      }
    } catch (augmentError) {
      console.error("[REPORT] Failed to augment attendee list:", augmentError);
      // Fallback to original form
    }

    const yearLevelBreakdown = processYearLevelBreakdown(augmentedForm, responses, previousForm, previousResponses);

    // --- NEW: Dynamic CSV column processing using service ---
    const dynamicCSVData = DynamicCSVReportService.processDynamicColumns(form.attendeeList);
    const dynamicColumns = dynamicCSVData.columns;
    const dynamicData = dynamicCSVData.data;

    // Calculate metrics
    const totalAttendees = form.attendeeList ? form.attendeeList.length : 0;
    const totalResponses = responses.length;
    const responseRate =
      totalAttendees > 0 ? (totalResponses / totalAttendees) * 100 : 0;

    const metrics = {
      totalResponses,
      totalAttendees,
      responseRate: Math.round(responseRate * 100) / 100,
      averageRating:
        filteredScaleResponses.length > 0
          ? filteredScaleResponses.reduce((sum, r) => sum + r.value, 0) /
          filteredScaleResponses.length
          : 0,
      lastUpdated: new Date().toISOString(),
    };

    res.status(200).json({
      success: true,
      data: {
        metrics,
        charts: {
          yearData,
          ratingDistribution,
          statusBreakdown,
          responseTrends,
          yearLevelBreakdown,
          dynamicColumns,
          dynamicData,
        },
        rawData: filteredScaleResponses,
        formInfo: {
          title: form.title,
          description: form.description,
          status: form.status,
          eventStartDate: form.eventStartDate,
          eventEndDate: form.eventEndDate,
          publishedAt: form.publishedAt,
        },
        filters: {
          startDate,
          endDate,
          ratingFilter,
          responseLimit,
        },
        isSnapshot: false,
        snapshotDate: null,
      },
    });
  } catch (error) {
    console.error("Error fetching dynamic quantitative data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dynamic quantitative data",
      error: error.message,
    });
  }
};

/**
 * Get dynamic qualitative data with filtering
 */
const getDynamicQualitativeData = async (req, res) => {
  try {
    const { reportId } = req.params;
    const {
      sentiment = "all",
      keyword,
      startDate,
      endDate,
      limit = 50,
    } = req.query;

    const userId = req.user._id;

    // Check shared access if necessary
    const hasAccess = await checkSharedReportAccess(reportId, req.user);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to view this report or it has expired",
      });
    }

    // Check system settings for anonymity
    const settings = await SystemSettings.getSettings();
    const isAnonymousMode =
      settings.generalSettings?.anonymousEvaluation ?? true;

    // Helper to process anonymity
    const processRespondentIdentity = (name, email) => {
      if (isAnonymousMode) {
        return { name: "Anonymous", email: null };
      }
      return { name: name || "Anonymous", email };
    };

    // Check cache for live data requests (not snapshot)
    if (req.query.useSnapshot !== "true") {
      const cacheKey = `qualitative_${reportId}_${sentiment}_${keyword || ""}_${startDate || ""
        }_${endDate || ""}_${limit}`;
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        console.log(`[REPORT] Cache HIT for qualitative data: ${reportId}`);
        return res.status(200).json({
          success: true,
          data: cachedData,
          cached: true,
        });
      }
      console.log(`[REPORT] Cache MISS for qualitative data: ${reportId}`);
    }

    // Find the form
    const form = await Form.findById(reportId).populate(
      "createdBy",
      "name email role",
    );
    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    // Check if we should use snapshot data (for generated reports)
    if (req.query.useSnapshot === "true") {
      const report = await Report.findOne({ formId: reportId, userId });
      if (report && report.dataSnapshot) {
        const snapshot = report.dataSnapshot;

        // Use snapshot sentiment and text responses
        return res.status(200).json({
          success: true,
          data: {
            sentimentBreakdown: snapshot.analytics.sentimentBreakdown,
            categorizedComments: snapshot.analytics.categorizedComments || {
              positive: [],
              neutral: [],
              negative: [],
            },
            questionBreakdown: snapshot.analytics.questionBreakdown || [],
            totalComments: (snapshot.textResponses || []).length,
            formInfo: {
              title: form.title,
              description: form.description,
              status: form.status,
            },
            filters: { sentiment, keyword, startDate, endDate, limit },
            isSnapshot: true,
            snapshotDate: snapshot.snapshotDate,
            lastUpdated: snapshot.snapshotDate,
          },
        });
      }
    }

    // No snapshot - continue with live data
    // Build filter for responses with text answers
    let responses = form.responses || [];

    // Date range filter
    if (startDate || endDate) {
      responses = responses.filter((response) => {
        const submittedAt = new Date(response.submittedAt);
        if (startDate && submittedAt < new Date(startDate)) return false;
        if (endDate && submittedAt > new Date(endDate)) return false;
        return true;
      });
    }

    // Build question type map for filtering
    const questionTypeMap = {};
    (form.questions || []).forEach((q) => {
      questionTypeMap[q._id.toString()] = q.type;
      questionTypeMap[q.title] = q.type;
    });

    // Extract text responses with type filtering AND MC option filtering
    const textResponses = extractTextResponses(responses, questionTypeMap, form.questions || []);

    // Perform sentiment analysis with type filtering AND orphan data protection
    const analysis = await AnalysisService.analyzeResponses(
      responses,
      questionTypeMap,
      form.questions || []
    );

    // --- NEW: Fetch Previous Year Data ---
    let previousYearData = null;
    try {
      const previousForm = await findPreviousYearForm(form);
      if (previousForm) {
        // Build question map for previous form
        const prevQuestionTypeMap = {};
        (previousForm.questions || []).forEach((q) => {
          prevQuestionTypeMap[q._id.toString()] = q.type;
          prevQuestionTypeMap[q.title] = q.type;
        });

        // Analyze previous form responses
        // We only need the summary, so this is lightweight enough
        const prevAnalysis = await AnalysisService.analyzeResponses(
          previousForm.responses || [],
          prevQuestionTypeMap
        );

        previousYearData = {
          formId: previousForm._id,
          title: previousForm.title,
          date: previousForm.createdAt,
          sentiment: prevAnalysis.sentimentBreakdown,
          insights: prevAnalysis.insights || [],
          // Calculate summary stats
          totalResponses: (previousForm.responses || []).length,
        };
      }
    } catch (err) {
      console.warn("Failed to process previous year data:", err);
      // Fail silently, just don't show comparison
    }
    // -------------------------------------

    // Filter by sentiment if specified
    let filteredTextResponses = textResponses;
    if (sentiment !== "all") {
      const sentimentKeywords = {
        positive: [
          "good",
          "great",
          "excellent",
          "amazing",
          "wonderful",
          "fantastic",
          "love",
          "like",
          "best",
          "awesome",
          "perfect",
          "satisfied",
          "happy",
          "pleased",
        ],
        negative: [
          "bad",
          "terrible",
          "awful",
          "horrible",
          "hate",
          "dislike",
          "worst",
          "disappointed",
          "unsatisfied",
          "sad",
          "angry",
          "frustrated",
          "poor",
          "fail",
        ],
        neutral: [],
      };

      const keywords = sentimentKeywords[sentiment] || [];
      if (keywords.length > 0) {
        filteredTextResponses = textResponses.filter((response) => {
          const text = (response.answer || "").toLowerCase();
          return keywords.some((keyword) => text.includes(keyword));
        });
      }
    }

    // Filter by keyword if specified
    if (keyword) {
      const keywordLower = keyword.toLowerCase();
      filteredTextResponses = filteredTextResponses.filter((response) =>
        (response.answer || "").toLowerCase().includes(keywordLower),
      );
    }

    // Categorize comments
    const categorizedComments = {
      positive: [],
      neutral: [],
      negative: [],
    };

    // Use centralized sentiment analysis for categorization
    const analyzePromises = filteredTextResponses
      .slice(0, parseInt(limit))
      .map(async (response) => {
        const answer = response.answer || "";

        // Use the centralized sentiment analysis function
        const sentimentResult =
          await AnalysisService.analyzeCommentSentiment(answer);
        const category = sentimentResult.sentiment;

        const identity = processRespondentIdentity(
          response.respondentName,
          response.respondentEmail,
        );

        return {
          category,
          data: {
            id: response.id,
            comment: answer,
            user: identity.name,
            email: identity.email,
            questionTitle: response.questionTitle,
            createdAt: response.submittedAt,
          },
        };
      });

    const analyzedResponses = await Promise.all(analyzePromises);

    // Categorize the analyzed responses
    analyzedResponses.forEach(({ category, data }) => {
      categorizedComments[category].push(data);
    });

    // NEW: Build per-question breakdown
    const questionBreakdown = [];
    const questions = form.questions || [];
    const allQuestionIds = questions.map((q) => q._id.toString());

    // Initialize buckets for each question
    const buckets = {};
    questions.forEach((q) => {
      buckets[q._id.toString()] = [];
    });

    // Bucket responses
    responses.forEach((response) => {
      // Track which questions have been "filled" by this specific response submission
      // This prevents multiple "Untitled Question" answers from all dumping into the first "Untitled Question" bucket
      const usedQuestionIds = new Set();

      if (response.responses && Array.isArray(response.responses)) {
        response.responses.forEach((ans) => {
          let targetQuestionId = null;

          // Strategy 1: Strict ID Match
          if (ans.questionId && buckets[ans.questionId]) {
            targetQuestionId = ans.questionId;
          }
          // Strategy 2: Title Match (Legacy Data Fallback)
          // Only if strict match failed AND title matches an active question
          else if (ans.questionTitle) {
            // Find all questions with matching title
            const candidates = questions.filter(
              (q) => q.title === ans.questionTitle,
            );

            // Find the first candidate that hasn't been used yet by this response
            const availableCandidate = candidates.find(
              (q) => !usedQuestionIds.has(q._id.toString()),
            );

            if (availableCandidate) {
              targetQuestionId = availableCandidate._id.toString();
            }
          }

          // Assign to bucket if a target was found
          if (targetQuestionId && buckets[targetQuestionId]) {
            buckets[targetQuestionId].push({
              answer: ans.answer,
              respondentName: response.respondentName,
              submittedAt: response.submittedAt,
            });
            // Mark this question as filled for this response
            usedQuestionIds.add(targetQuestionId);
          }
        });
      }
    });

    for (const question of questions) {
      const questionId = question._id.toString();
      const questionTitle = question.title;
      const questionType = question.type;

      // Get all responses for this specific question from our buckets
      const questionResponses = buckets[questionId] || [];
      const responseCount = questionResponses.length;

      if (questionType === "scale") {
        // For scale questions: show rating distribution
        const min = question.low || 1;
        const max = question.high || 5;
        const ratingCounts = {};

        // Initialize counts dynamically
        for (let i = min; i <= max; i++) {
          ratingCounts[i] = 0;
        }

        questionResponses.forEach((r) => {
          const rating = parseInt(r.answer) || 0;
          if (rating >= min && rating <= max) {
            ratingCounts[rating]++;
          }
        });

        // Generate distribution array
        const ratingDistribution = Object.entries(ratingCounts).map(
          ([rating, count]) => ({
            name: `${rating}`,
            value:
              responseCount > 0 ? Math.round((count / responseCount) * 100) : 0,
            count: count,
          }),
        );

        const avgRating =
          responseCount > 0
            ? questionResponses.reduce(
              (sum, r) => sum + (parseInt(r.answer) || 0),
              0,
            ) / responseCount
            : 0;

        questionBreakdown.push({
          questionId,
          questionTitle,
          questionType,
          responseCount,
          ratingDistribution,
          averageRating: Math.round(avgRating * 100) / 100,
          scaleMax: max,
        });
      } else if (
        questionType === "paragraph" ||
        questionType === "short_answer"
      ) {
        // For text questions: show sentiment breakdown using AnalysisService (PYTHON)
        let positiveCount = 0;
        let neutralCount = 0;
        let negativeCount = 0;
        const sampleResponses = [];

        // Use Promise.all if there are many responses, but careful with rate limits/performance
        // Given the cache in analyzeCommentSentiment, this should be efficient
        for (let i = 0; i < questionResponses.length; i++) {
          const r = questionResponses[i];
          const answer = r.answer || "";

          if (!answer.trim()) continue;

          // USE ADVANCED SENTIMENT ANALYSIS (PYTHON)
          const sentimentResult = await AnalysisService.analyzeCommentSentiment(answer);
          const sentiment = sentimentResult.sentiment;

          if (sentiment === "positive") positiveCount++;
          else if (sentiment === "negative") negativeCount++;
          else neutralCount++;

          // Keep sample of responses
          if (sampleResponses.length < 6) {
            const identity = processRespondentIdentity(
              r.respondentName,
              r.respondentEmail,
            );
            sampleResponses.push({
              text: r.answer,
              sentiment,
              respondentName: identity.name,
            });
          }
        }

        const total = positiveCount + neutralCount + negativeCount;
        const sentimentBreakdown = {
          positive: {
            count: positiveCount,
            percentage: total > 0 ? Math.round((positiveCount / total) * 100) : 0,
          },
          neutral: {
            count: neutralCount,
            percentage: total > 0 ? Math.round((neutralCount / total) * 100) : 0,
          },
          negative: {
            count: negativeCount,
            percentage: total > 0 ? Math.round((negativeCount / total) * 100) : 0,
          },
        };

        questionBreakdown.push({
          questionId,
          questionTitle,
          questionType,
          responseCount,
          sentimentBreakdown,
          sampleResponses,
        });
      } else if (questionType === "multiple_choice") {
        // For multiple choice: show option distribution
        const optionCounts = {};
        question.options.forEach((opt) => {
          optionCounts[opt] = 0;
        });

        questionResponses.forEach((r) => {
          const answer = r.answer;
          if (Array.isArray(answer)) {
            answer.forEach((a) => {
              if (optionCounts[a] !== undefined) optionCounts[a]++;
            });
          } else if (optionCounts[answer] !== undefined) {
            optionCounts[answer]++;
          }
        });

        const optionDistribution = Object.entries(optionCounts).map(
          ([option, count]) => ({
            name: option,
            value:
              responseCount > 0 ? Math.round((count / responseCount) * 100) : 0,
            count: count,
          }),
        );

        questionBreakdown.push({
          questionId,
          questionTitle,
          questionType,
          responseCount,
          optionDistribution,
        });
      }
    }

    const responseData = {
      sentimentBreakdown: analysis.sentimentBreakdown,
      categorizedComments,
      questionBreakdown,
      totalComments: filteredTextResponses.length,
      formInfo: {
        title: form.title,
        description: form.description,
        status: form.status,
      },
      filters: {
        sentiment,
        keyword,
        startDate,
        endDate,
        limit,
      },
      previousYearData, // <--- Include in response
      lastUpdated: new Date().toISOString(),
    };

    // Cache the qualitative data for 10 minutes (600 seconds)
    if (req.query.useSnapshot !== "true") {
      const cacheKey = `qualitative_${reportId}_${sentiment}_${keyword || ""}_${startDate || ""
        }_${endDate || ""}_${limit}`;
      cache.set(cacheKey, responseData, 600);
      console.log(`[REPORT] Cached qualitative data for: ${reportId}`);
    }

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Error fetching dynamic qualitative data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dynamic qualitative data",
      error: error.message,
    });
  }
};

/**
 * Get dynamic comments data with advanced filtering
 */
const getDynamicCommentsData = async (req, res) => {
  try {
    const { reportId } = req.params;

    // Check shared access if necessary
    const hasAccess = await checkSharedReportAccess(reportId, req.user);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to view this report or it has expired",
      });
    }

    // Check system settings for anonymity
    const settings = await SystemSettings.getSettings();
    const isAnonymousMode =
      settings.generalSettings?.anonymousEvaluation ?? true;
    const {
      type = "all", // all, positive, neutral, negative
      searchTerm,
      dateRange,
      role,
      ratingRange,
      sortBy = "date",
      sortOrder = "desc",
      page = 1,
      limit = 20,
    } = req.query;

    const userId = req.user._id;

    // Find the form
    const form = await Form.findById(reportId).populate(
      "createdBy",
      "name email role",
    );
    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    // Build question type map for filtering
    const questionTypeMap = {};
    (form.questions || []).forEach((q) => {
      questionTypeMap[q._id.toString()] = q.type;
      questionTypeMap[q.title] = q.type;
    });

    // Extract all individual text responses first
    let allComments = extractTextResponses(form.responses || [], questionTypeMap);

    // Apply sentiment filter (type)
    if (type !== "all") {
      const analysisPromises = allComments.map(async (comment) => {
        const sentimentResult = await AnalysisService.analyzeCommentSentiment(comment.answer);
        return { ...comment, sentiment: sentimentResult.sentiment };
      });
      const analyzedComments = await Promise.all(analysisPromises);
      allComments = analyzedComments.filter(c => c.sentiment === type);
    } else {
      // Still need sentiment for the UI
      const analysisPromises = allComments.map(async (comment) => {
        const sentimentResult = await AnalysisService.analyzeCommentSentiment(comment.answer);
        return { ...comment, sentiment: sentimentResult.sentiment };
      });
      allComments = await Promise.all(analysisPromises);
    }

    // Apply Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      allComments = allComments.filter(c => 
        (c.answer || "").toLowerCase().includes(term) ||
        (c.questionTitle || "").toLowerCase().includes(term) ||
        (c.respondentName || "").toLowerCase().includes(term)
      );
    }

    // Apply Date Range filter
    if (dateRange) {
      const [start, end] = dateRange.split(",");
      if (start && end) {
        const startDateObj = new Date(start);
        const endDateObj = new Date(end);
        allComments = allComments.filter(c => {
          const commentDate = new Date(c.submittedAt);
          return commentDate >= startDateObj && commentDate <= endDateObj;
        });
      }
    }

    // Apply Role filter
    if (role && form.attendeeList) {
      allComments = allComments.filter(c => {
        const attendee = form.attendeeList.find(a => a.email === c.respondentEmail);
        return attendee && attendee.role === role;
      });
    }

    // Sort comments
    allComments.sort((a, b) => {
      const aVal = sortBy === "date" ? new Date(a.submittedAt) : (a[sortBy] || "");
      const bVal = sortBy === "date" ? new Date(b.submittedAt) : (b[sortBy] || "");
      
      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    // Calculate pagination
    const totalCount = allComments.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedComments = allComments.slice(skip, skip + parseInt(limit));

    const comments = paginatedComments.map((c) => {
      let name = c.respondentName || "Anonymous";
      let email = c.respondentEmail;

      if (isAnonymousMode) {
        name = "Anonymous";
        email = null;
      }

      return {
        id: c.id,
        comment: c.answer,
        user: name,
        email: email,
        questionTitle: c.questionTitle,
        submittedAt: c.submittedAt,
        sentiment: c.sentiment
      };
    });

    res.status(200).json({
      success: true,
      data: {
        comments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / parseInt(limit)),
        },
        formInfo: {
          title: form.title,
          description: form.description,
          status: form.status,
        },
        filters: {
          type,
          searchTerm,
          dateRange,
          role,
          ratingRange,
          sortBy,
          sortOrder,
        },
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching dynamic comments data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dynamic comments data",
      error: error.message,
    });
  }
};

/**
 * Get all reports with live data and metrics (Only generated reports)
 */
const getAllReportsWithLiveData = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      status = "all",
      dateRange,
      search,
      limit = 50,
      page = 1,
    } = req.query;

    // School admins don't create reports, they view shared ones
    // Since sharing is not implemented yet, return empty array
    if (req.user.role === "school-admin") {
      return res.status(200).json({
        success: true,
        data: {
          reports: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0,
          },
          filters: {
            status,
            dateRange,
            search,
            limit,
            page,
          },
          lastUpdated: new Date().toISOString(),
        },
      });
    }

    // Build filter for REPORTS
    let reportFilter = { userId: userId, isGenerated: true };

    if (status !== "all") {
      reportFilter.status = status;
    }

    if (dateRange) {
      const [start, end] = dateRange.split(",");
      if (start && end) {
        reportFilter.eventDate = {
          $gte: new Date(start),
          $lte: new Date(end),
        };
      }
    }

    if (search) {
      reportFilter.title = {
        $regex: search,
        $options: "i",
      };
    }

    // Get reports with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const reports = await Report.find(reportFilter)
      .populate("formId") // Populate form to access responses
      .sort({ lastUpdated: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Update each report with live data OR return snapshot
    const reportsWithLiveData = await Promise.all(
      reports.map(async (report) => {
        const form = report.formId;

        // If form is deleted or missing, return the stored report
        if (!form)
          return {
            id: report._id,
            title: report.title,
            eventDate: report.eventDate,
            status: report.status,
            feedbackCount: report.feedbackCount,
            averageRating: report.averageRating,
            thumbnail: report.thumbnail,
            lastUpdated: report.lastUpdated,
            metadata: report.metadata,
            analytics: report.analytics,
            isSnapshot: !!report.dataSnapshot,
            snapshotDate: report.dataSnapshot?.snapshotDate || null,
          };

        // If report has a snapshot, return frozen data (no live updates)
        if (report.dataSnapshot) {
          return {
            id: report._id,
            formId: form._id,
            title: report.title,
            eventDate: report.eventDate,
            status: report.status,
            feedbackCount: report.feedbackCount,
            averageRating: report.averageRating,
            thumbnail: report.thumbnail,
            lastUpdated: report.lastUpdated,
            metadata: report.metadata,
            analytics: report.analytics,
            isSnapshot: true,
            snapshotDate: report.dataSnapshot.snapshotDate,
          };
        }

        // No snapshot - calculate live data (for backward compatibility)
        const totalAttendees = form.attendeeList ? form.attendeeList.length : 0;
        const totalResponses = form.responses ? form.responses.length : 0;
        const responseRate =
          totalAttendees > 0 ? (totalResponses / totalAttendees) * 100 : 0;

        // Calculate average rating from scale responses
        const scaleResponses = extractScaleResponses(form.responses || []);
        const averageRating =
          scaleResponses.length > 0
            ? scaleResponses.reduce((sum, r) => sum + r.value, 0) /
            scaleResponses.length
            : 0;

        // Get recent responses (last 7 days)
        const recentResponses = form.responses
          ? form.responses.filter((response) => {
            const responseDate = new Date(response.submittedAt);
            return (
              responseDate >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            );
          }).length
          : 0;

        // Build question type map for filtering
        const questionTypeMap = {};
        (form.questions || []).forEach((q) => {
          questionTypeMap[q._id.toString()] = q.type;
          questionTypeMap[q.title] = q.type;
        });

        // Perform sentiment analysis (use Python for consistency)
        const responseAnalysis = await AnalysisService.analyzeResponses(
          form.responses || [],
          questionTypeMap,
        );
        const sentimentBreakdown = responseAnalysis.sentimentBreakdown || {
          positive: { count: 0, percentage: 0 },
          neutral: { count: 0, percentage: 0 },
          negative: { count: 0, percentage: 0 },
        };

        // Generate chart data
        const yearData = processYearlyDataFromForm(form, form.responses || []);
        const ratingDistribution =
          processRatingDistributionFromForm(scaleResponses);
        const statusBreakdown = processStatusBreakdownFromForm(form);
        const responseTrends = processResponseTrendsFromForm(
          form.responses || [],
        );

        // Update report in database with live data
        report.feedbackCount = totalResponses;
        report.averageRating = Math.round(averageRating * 100) / 100;
        report.metadata = {
          description: form.description,
          attendeeCount: totalAttendees,
          responseRate: Math.round(responseRate * 100) / 100,
          eventStartDate: form.eventStartDate,
          eventEndDate: form.eventEndDate,
        };
        report.analytics = {
          sentimentBreakdown,
          quantitativeData: {
            totalResponses,
            totalAttendees,
            responseRate: Math.round(responseRate * 100) / 100,
            averageRating: Math.round(averageRating * 100) / 100,
          },
          charts: {
            yearData,
            ratingDistribution,
            statusBreakdown,
            responseTrends,
          },
        };

        await report.save();

        return {
          id: report._id, // Use report ID, not form ID
          formId: form._id,
          title: report.title,
          eventDate: report.eventDate,
          status: report.status,
          feedbackCount: totalResponses,
          averageRating: Math.round(averageRating * 100) / 100,
          recentComments: recentResponses,
          creator: form.createdBy, // Or report.userId
          thumbnail: report.thumbnail,
          lastUpdated: report.lastUpdated,
          metadata: report.metadata,
          isSnapshot: false,
          snapshotDate: null,
        };
      }),
    );

    // Get total count for pagination
    const totalCount = await Report.countDocuments(reportFilter);

    res.status(200).json({
      success: true,
      data: {
        reports: reportsWithLiveData,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / parseInt(limit)),
        },
        filters: {
          status,
          dateRange,
          search,
          limit,
          page,
        },
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching reports with live data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reports with live data",
      error: error.message,
    });
  }
};

/**
 * Generate a report for a form (sets isGenerated to true)
 */
const generateReport = async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = req.user._id;

    // Find the form
    const form = await Form.findOne({ _id: formId, createdBy: userId });
    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found or access denied",
      });
    }

    // Calculate response rate
    const totalAttendees = form.attendeeList ? form.attendeeList.length : 0;
    const totalResponses = form.responses ? form.responses.length : 0;
    const responseRate =
      totalAttendees > 0 ? (totalResponses / totalAttendees) * 100 : 0;

    // Check if response rate is sufficient (>= 50%)
    if (responseRate < 50) {
      return res.status(400).json({
        success: false,
        message: "Response rate must be at least 50% to generate a report",
        currentRate: Math.round(responseRate * 100) / 100,
      });
    }

    // Perform analysis and generate report data
    // Perform sentiment analysis (use Python for consistency)
    const questionTypeMap = {};
    (form.questions || []).forEach((q) => {
      questionTypeMap[q._id.toString()] = q.type;
      questionTypeMap[q.title] = q.type; 
    });

    const responseAnalysis = await AnalysisService.analyzeResponses(
      form.responses || [],
      questionTypeMap,
      form.questions || []
    );
    const sentimentBreakdown = responseAnalysis.sentimentBreakdown || {
      positive: { count: 0, percentage: 0 },
      neutral: { count: 0, percentage: 0 },
      negative: { count: 0, percentage: 0 },
    };

    // Calculate average rating
    const scaleResponses = extractScaleResponses(form.responses || []);
    const averageRating =
      scaleResponses.length > 0
        ? scaleResponses.reduce((sum, r) => sum + r.value, 0) /
        scaleResponses.length
        : 0;

    // Generate chart data
    const yearData = processYearlyDataFromForm(form, form.responses || []);
    const ratingDistribution =
      processRatingDistributionFromForm(scaleResponses);
    const statusBreakdown = processStatusBreakdownFromForm(form);
    const responseTrends = processResponseTrendsFromForm(form.responses || []);

    // --- NEW: Fetch Previous Year Data for Breakdown ---
    let previousForm = null;
    let previousResponses = [];
    try {
      previousForm = await findPreviousYearForm(form);
      if (previousForm) {
        previousResponses = previousForm.responses || [];
      }
    } catch (err) {
      console.error("[LINKING] Error fetching previous form for breakdown:", err);
    }

    // --- NEW: Augment Attendee List for Missing Users ---
    let augmentedForm = form;
    try {
      const existingEmails = new Set((form.attendeeList || []).map(a => a.email?.toLowerCase()).filter(Boolean));
      const missingEmails = (form.responses || [])
        .map(r => r.respondentEmail?.toLowerCase())
        .filter(email => email && !existingEmails.has(email));
      
      if (missingEmails.length > 0) {
        const foundUsers = await User.find({ email: { $in: missingEmails } }).select('email name department yearLevel role');
        if (foundUsers.length > 0) {
          const extraAttendees = foundUsers.map(u => ({
            email: u.email,
            department: u.department,
            yearLevel: u.yearLevel,
            name: u.name,
            role: u.role
          }));
          const plainForm = form.toObject ? form.toObject() : { ...form };
          plainForm.attendeeList = [...(plainForm.attendeeList || []), ...extraAttendees];
          augmentedForm = plainForm;
        }
      }
    } catch (augmentError) {
      console.error("[REPORT] Failed to augment attendee list in generateReport:", augmentError);
    }

    const yearLevelBreakdown = processYearLevelBreakdown(augmentedForm, form.responses || [], previousForm, previousResponses);

    // Generate thumbnail
    const thumbnail = await ThumbnailService.generateReportThumbnail(
      form._id,
      form.title || "Event Evaluation Report",
    );

    const reportData = {
      formId: form._id,
      userId: userId,
      title: form.title,
      eventDate: form.eventStartDate || form.createdAt,
      status: form.status,
      isGenerated: true, // Mark as generated
      feedbackCount: totalResponses,
      averageRating: Math.round(averageRating * 100) / 100,
      thumbnail: thumbnail,
      metadata: {
        description: form.description,
        attendeeCount: totalAttendees,
        responseRate: Math.round(responseRate * 100) / 100,
        eventStartDate: form.eventStartDate,
        eventEndDate: form.eventEndDate,
      },
      analytics: {
        sentimentBreakdown,
        quantitativeData: {
          totalResponses,
          totalAttendees,
          responseRate: Math.round(responseRate * 100) / 100,
          averageRating: Math.round(averageRating * 100) / 100,
        },
        charts: {
          yearData,
          ratingDistribution,
          statusBreakdown,
          responseTrends,
          yearLevelBreakdown, // Include in static snapshot
        },
      },
      // Create frozen snapshot of all data at generation time
      dataSnapshot: {
        responses: form.responses || [],
        scaleResponses: scaleResponses,
        textResponses: extractTextResponses(form.responses || [], questionTypeMap, form.questions || []),
        analytics: {
          sentimentBreakdown,
          quantitativeData: {
            totalResponses,
            totalAttendees,
            responseRate: Math.round(responseRate * 100) / 100,
            averageRating: Math.round(averageRating * 100) / 100,
          },
          charts: {
            yearData,
            ratingDistribution,
            statusBreakdown,
            responseTrends,
            yearLevelBreakdown, // Include in static snapshot
          },
          categorizedComments: responseAnalysis.categorizedComments,
          questionBreakdown: processCompleteQuestionBreakdown(
            form, 
            form.responses || [], 
            responseAnalysis.questionBreakdown || []
          ),
        },
        metadata: {
          description: form.description,
          attendeeCount: totalAttendees,
          responseRate: Math.round(responseRate * 100) / 100,
          eventStartDate: form.eventStartDate,
          eventEndDate: form.eventEndDate,
        },
        snapshotDate: new Date(),
      },
    };

    // Save or update report
    let report = await Report.findOne({ formId: form._id, userId });
    if (report) {
      Object.assign(report, reportData);
      await report.save();
    } else {
      report = new Report(reportData);
      await report.save();
    }

    // Emit socket event for real-time updates
    emitUpdate("report-generated", {
      reportId: report._id,
      formId: form._id,
      userId: userId,
      title: form.title,
      status: "generated",
      createdAt: new Date()
    }, userId);

    res.status(200).json({
      success: true,
      message: "Report generated successfully",
      data: report,
    });
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate report",
      error: error.message,
    });
  }
};

// Helper functions

/**
 * Extract scale responses from form responses
 */
function extractScaleResponses(responses) {
  const scaleResponses = [];

  responses.forEach((response) => {
    if (response.responses) {
      response.responses.forEach((item) => {
        // Check if this is a scale/rating question
        if (
          typeof item.answer === "number" &&
          item.answer >= 1 &&
          item.answer <= 10
        ) {
          scaleResponses.push({
            id: response.id || Math.random().toString(36).substr(2, 9),
            value: item.answer,
            questionTitle: item.questionTitle,
            respondentEmail: response.respondentEmail,
            respondentName: response.respondentName,
            submittedAt: response.submittedAt,
          });
        }
      });
    }
  });

  return scaleResponses;
}

/**
 * Extract text responses from form responses
 */
function extractTextResponses(responses, questionTypeMap = null, questionsSource = []) {
  const textResponses = [];

  // Build a map of Title -> Set of Options to detect collision
  const titleToOptionsMap = {};
  if (Array.isArray(questionsSource)) {
    questionsSource.forEach(q => {
      if (q.options && Array.isArray(q.options) && q.title) {
        if (!titleToOptionsMap[q.title]) {
          titleToOptionsMap[q.title] = new Set();
        }
        q.options.forEach(opt => titleToOptionsMap[q.title].add(String(opt).trim()));
      }
    });
  }

  responses.forEach((response) => {
    if (response.responses) {
      response.responses.forEach((item) => {
        // Apply question type filter if available
        if (questionTypeMap) {
          const qType =
            questionTypeMap[item.questionId] ||
            questionTypeMap[item.questionTitle];
          if (qType !== "paragraph" && qType !== "short_answer") return;
        }

        // Check if this is a text response
        if (typeof item.answer === "string" && item.answer.trim().length > 0) {
          const trimmed = item.answer.trim();

          // Safety Check: Is this "text" actually a known option for a question with this title?
          // This handles cases where an MC question shares a title with a Text question (especially with orphaned IDs)
          if (titleToOptionsMap[item.questionTitle] && titleToOptionsMap[item.questionTitle].has(trimmed)) {
            return; // Skip: This is an MC option masquerading as text
          }

          textResponses.push({
            id: response.id || Math.random().toString(36).substr(2, 9),
            answer: item.answer,
            questionTitle: item.questionTitle,
            respondentEmail: response.respondentEmail,
            respondentName: response.respondentName,
            submittedAt: response.submittedAt,
          });
        }
      });
    }
  });

  return textResponses;
}

/**
 * Process yearly data from form
 */
function processYearlyDataFromForm(form, responses) {
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;

  const currentYearData = { name: `${currentYear}`, value: 0 };
  const lastYearData = { name: `${lastYear}`, value: 0 };

  responses.forEach((response) => {
    const responseYear = new Date(response.submittedAt).getFullYear();
    if (responseYear === currentYear) {
      currentYearData.value++;
    } else if (responseYear === lastYear) {
      lastYearData.value++;
    }
  });

  return [lastYearData, currentYearData];
}

/**
 * Process year level breakdown (1st year, 2nd year, etc.) from attendee list
 * Maps attendee emails to responses and counts by year level, separated by calendar year
 */
function processYearLevelBreakdown(form, responses, previousForm = null, previousResponses = []) {
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  // Helper to normalize year level values
  const normalizeYearLevel = (yearLevel, department) => {
    if (!yearLevel) return null;
    const normalized = yearLevel.toString().toLowerCase().trim();

    // Handle Higher Education / College
    if (
      !department ||
      department.toLowerCase().includes("higher") ||
      department.toLowerCase().includes("college")
    ) {
      if (
        normalized === "1" ||
        normalized === "1st" ||
        normalized === "first" ||
        normalized === "first year" ||
        normalized.includes("1st year")
      )
        return "1st Year";
      if (
        normalized === "2" ||
        normalized === "2nd" ||
        normalized === "second" ||
        normalized === "second year" ||
        normalized.includes("2nd year")
      )
        return "2nd Year";
      if (
        normalized === "3" ||
        normalized === "3rd" ||
        normalized === "third" ||
        normalized === "third year" ||
        normalized.includes("3rd year")
      )
        return "3rd Year";
      if (
        normalized === "4" ||
        normalized === "4th" ||
        normalized === "fourth" ||
        normalized === "fourth year" ||
        normalized.includes("4th year")
      )
        return "4th Year";
    }

    // Handle Basic Education
    if (
      department &&
      (department.toLowerCase().includes("basic") ||
        department.toLowerCase().includes("education"))
    ) {
      if (normalized.startsWith("grade")) {
        // Capitalize Grade
        const parts = normalized.split(" ");
        if (parts.length > 1) {
          return "Grade " + parts[1];
        }
        return normalized.charAt(0).toUpperCase() + normalized.slice(1);
      }
      if (!isNaN(normalized)) {
        return `Grade ${normalized}`;
      }
    }

    // Fallback: just return as is but capitalized
    return yearLevel.toString().trim();
  };

  // Create a map of attendee emails to their metadata (year level and department)
  const attendeeMetadata = {};
  const attendeeList = form.attendeeList || [];
  const detectedDepartments = new Set();

  attendeeList.forEach((attendee) => {
    if (attendee.email) {
      let department = attendee.department;
      const rawYear = attendee.yearLevel || "";

      // Infer or Correct department based on year level
      // 1. If missing, infer check
      // 2. If "Higher Education" (default) but year is clearly Basic Ed (Grade/Kinder), override it
      const isDefaultOrMissing = !department || department === "Higher Education";
      if (isDefaultOrMissing && rawYear) {
        const lowerYear = rawYear.toString().toLowerCase();
        if (lowerYear.includes("grade") || lowerYear.includes("kinder") || lowerYear.includes("nursery") || (!isNaN(lowerYear) && parseInt(lowerYear) > 4)) {
          department = "Basic Education";
        }
      }
      department = department || "Higher Education";
      const normalizedLevel = normalizeYearLevel(attendee.yearLevel, department);

      if (normalizedLevel) {
        attendeeMetadata[attendee.email.toLowerCase()] = {
          yearLevel: normalizedLevel,
          department: department,
        };
        detectedDepartments.add(department);
      }
    }
  });

  // If no departments detected, default to Higher Education
  if (detectedDepartments.size === 0) {
    detectedDepartments.add("Higher Education");
  }

  // Initialize data structure for departments
  const departmentData = {};
  detectedDepartments.forEach((dept) => {
    departmentData[dept] = {
      currentYear: { year: currentYear, counts: {}, total: 0 },
      previousYear: { year: previousYear, counts: {}, total: 0 },
    };
  });

  // 1. Count current year responses using current form's attendee metadata
  responses.forEach((response) => {
    const email = response.respondentEmail?.toLowerCase();
    const meta = attendeeMetadata[email];
    if (!meta) return;

    const { yearLevel, department } = meta;
    // For the current report, we show it in the current year bucket
    departmentData[department].currentYear.counts[yearLevel] =
      (departmentData[department].currentYear.counts[yearLevel] || 0) + 1;
    departmentData[department].currentYear.total++;
  });

  // 2. Count previous year responses if previous form provided
  if (previousForm && previousResponses.length > 0) {
    const prevAttendeeMetadata = {};
    const prevAttendeeList = previousForm.attendeeList || [];
    
    prevAttendeeList.forEach((attendee) => {
      if (attendee.email) {
        const department = attendee.department || "Higher Education";
        const normalizedLevel = normalizeYearLevel(attendee.yearLevel, department);
        if (normalizedLevel) {
          prevAttendeeMetadata[attendee.email.toLowerCase()] = {
            yearLevel: normalizedLevel,
            department: department,
          };
          if (!departmentData[department]) {
            departmentData[department] = {
              currentYear: { year: currentYear, counts: {}, total: 0 },
              previousYear: { year: previousYear, counts: {}, total: 0 },
            };
          }
        }
      }
    });

    previousResponses.forEach((response) => {
      const email = response.respondentEmail?.toLowerCase();
      const meta = prevAttendeeMetadata[email];
      if (!meta) return;

      const { yearLevel, department } = meta;
      departmentData[department].previousYear.counts[yearLevel] =
        (departmentData[department].previousYear.counts[yearLevel] || 0) + 1;
      departmentData[department].previousYear.total++;
    });
  }

  // Convert to final structure
  const result = {
    departments: Object.entries(departmentData).map(([deptName, data]) => {
      // Determine standard labels for this department
      let standardLabels = [];
      const lowerDept = deptName.toLowerCase();

      if (lowerDept.includes("higher") || lowerDept.includes("college")) {
        // Dynamic keys only - no forced presets
        const allKeys = new Set([
          ...Object.keys(data.currentYear.counts),
          ...Object.keys(data.previousYear.counts),
        ]);
        
        // Custom sort for Higher Ed years
        const sortOrder = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];
        standardLabels = Array.from(allKeys).sort((a, b) => {
          const idxA = sortOrder.indexOf(a);
          const idxB = sortOrder.indexOf(b);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.localeCompare(b);
        });
      } else if (
        lowerDept.includes("basic") ||
        lowerDept.includes("high school") ||
        lowerDept.includes("elementary")
      ) {
        // Collect all grades found in data
        const allGrades = new Set([
          ...Object.keys(data.currentYear.counts),
          ...Object.keys(data.previousYear.counts),
        ]);
        standardLabels = Array.from(allGrades).sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, ""));
          const numB = parseInt(b.replace(/\D/g, ""));
          // If no numbers, sort alphabetically
          if (isNaN(numA) || isNaN(numB)) return a.localeCompare(b);
          return numA - numB;
        });
      } else {
        standardLabels = Array.from(
          new Set([
            ...Object.keys(data.currentYear.counts),
            ...Object.keys(data.previousYear.counts),
          ]),
        ).sort();
      }

      const buildBreakdown = (yearData) => ({
        year: yearData.year,
        total: yearData.total,
        breakdown: standardLabels.map((label) => ({
          name: label,
          count: yearData.counts[label] || 0,
          percentage:
            yearData.total > 0
              ? Math.round(((yearData.counts[label] || 0) / yearData.total) * 100)
              : 0,
        })),
      });

      return {
        name: deptName,
        currentYear: buildBreakdown(data.currentYear),
        previousYear: buildBreakdown(data.previousYear),
      };
    }),
  };

  // Add backward compatibility for Higher Education at the top level
  // This ensures the current UI doesn't break while we're updating it
  const higherEd =
    result.departments.find(
      (d) =>
        d.name.toLowerCase().includes("higher") ||
        d.name.toLowerCase().includes("college"),
    ) || result.departments[0];

  if (higherEd) {
    result.currentYear = higherEd.currentYear;
    result.previousYear = higherEd.previousYear;
  }

  return result;
}

/**
 * Process rating distribution from form scale responses
 */
function processRatingDistributionFromForm(scaleResponses) {
  const distribution = [
    { name: "Very Poor (1-2)", value: 0 },
    { name: "Poor (3-4)", value: 0 },
    { name: "Fair (5-6)", value: 0 },
    { name: "Good (7-8)", value: 0 },
    { name: "Excellent (9-10)", value: 0 },
  ];

  scaleResponses.forEach((response) => {
    const rating = response.value || 0;
    if (rating >= 1 && rating <= 2) distribution[0].value++;
    else if (rating >= 3 && rating <= 4) distribution[1].value++;
    else if (rating >= 5 && rating <= 6) distribution[2].value++;
    else if (rating >= 7 && rating <= 8) distribution[3].value++;
    else if (rating >= 9 && rating <= 10) distribution[4].value++;
  });

  return distribution;
}

/**
 * Process status breakdown from form
 */
function processStatusBreakdownFromForm(form) {
  const totalAttendees = form.attendeeList ? form.attendeeList.length : 0;
  const respondedAttendees = form.attendeeList
    ? form.attendeeList.filter((attendee) => attendee.hasResponded).length
    : 0;
  const nonRespondedAttendees = totalAttendees - respondedAttendees;

  return [
    { name: "Responded", value: respondedAttendees },
    { name: "Not Responded", value: nonRespondedAttendees },
  ];
}

/**
 * Process response trends from form
 */
function processResponseTrendsFromForm(responses) {
  const trends = {};

  responses.forEach((response) => {
    const date = new Date(response.submittedAt).toISOString().split("T")[0];
    trends[date] = (trends[date] || 0) + 1;
  });

  return Object.entries(trends)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Get saved reports from database
 */
const getSavedReports = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      status = "all",
      dateRange,
      search,
      limit = 50,
      page = 1,
      department,
      ratingFilter,
    } = req.query;

    // Build filter for reports
    let reportFilter = { userId };

    if (status !== "all") {
      reportFilter.status = status;
    }

    if (dateRange) {
      const [start, end] = dateRange.split(",");
      if (start && end) {
        reportFilter.eventDate = {
          $gte: new Date(start),
          $lte: new Date(end),
        };
      }
    }

    if (search) {
      reportFilter.title = {
        $regex: search,
        $options: "i",
      };
    }

    if (department) {
      reportFilter["metadata.department"] = department;
    }

    if (ratingFilter) {
      const [min, max] = ratingFilter.split("-").map(Number);
      if (!isNaN(min) && !isNaN(max)) {
        reportFilter.averageRating = {
          $gte: min,
          $lte: max,
        };
      }
    }

    // Get reports with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const reports = await Report.find(reportFilter)
      .populate("formId", "title description status")
      .sort({ lastUpdated: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const totalCount = await Report.countDocuments(reportFilter);

    // Format reports for frontend
    const formattedReports = reports.map((report) => ({
      id: report._id,
      title: report.title,
      eventDate: report.eventDate,
      status: report.status,
      feedbackCount: report.feedbackCount,
      averageRating: report.averageRating,
      thumbnail: report.thumbnail,
      lastUpdated: report.lastUpdated,
      metadata: report.metadata,
      analytics: report.analytics,
    }));

    res.status(200).json({
      success: true,
      data: {
        reports: formattedReports,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / parseInt(limit)),
        },
        filters: {
          status,
          dateRange,
          search,
          department,
          ratingFilter,
        },
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching saved reports:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch saved reports",
      error: error.message,
    });
  }
};

/**
 * Get dynamic column breakdown for a specific column
 * GET /api/reports/:reportId/dynamic-breakdown/:columnName
 */
const getDynamicColumnBreakdown = async (req, res) => {
  try {
    const { reportId, columnName } = req.params;
    const { includeResponses = "false" } = req.query;

    // Check shared access if necessary
    const hasAccess = await checkSharedReportAccess(reportId, req.user);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view this report or it has expired",
      });
    }

    // Find the form
    const form = await Form.findById(reportId);
    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    // Get responses if requested
    let responses = [];
    if (includeResponses === "true") {
      responses = form.responses || [];
    }

    // Generate breakdown for the specified column
    const breakdown = DynamicCSVReportService.generateColumnBreakdown(
      form.attendeeList,
      columnName,
      responses
    );

    // Get column metadata if available
    const columnMetadata = form.csvColumnMetadata?.[columnName] || null;

    res.status(200).json({
      success: true,
      data: {
        columnName,
        breakdown,
        metadata: columnMetadata,
        totalAttendees: form.attendeeList?.length || 0,
        totalResponses: responses.length,
      },
    });
  } catch (error) {
    console.error("Error fetching dynamic column breakdown:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dynamic column breakdown",
      error: error.message,
    });
  }
};

/**
 * Get column suggestions for filtering and analysis
 * GET /api/reports/:reportId/column-suggestions
 */
const getColumnSuggestions = async (req, res) => {
  try {
    const { reportId } = req.params;

    // Check shared access if necessary
    const hasAccess = await checkSharedReportAccess(reportId, req.user);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view this report or it has expired",
      });
    }

    // Find the form
    const form = await Form.findById(reportId);
    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    // Get column suggestions
    const suggestions = DynamicCSVReportService.getColumnSuggestions(
      form.attendeeList
    );

    res.status(200).json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    console.error("Error fetching column suggestions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch column suggestions",
      error: error.message,
    });
  }
};

/**
 * Process complete question breakdown for all question types
 * Merges text analysis results with computed stats for scale/MC questions
 */
function processCompleteQuestionBreakdown(form, responses, textBreakdown) {
  const breakdownMap = new Map();

  // 1. Initialize with all questions from the form
  if (form.questions && Array.isArray(form.questions)) {
    form.questions.forEach(q => {
      // Logic for Scale questions
      if (q.type === 'scale') {
        breakdownMap.set(q._id.toString(), {
          questionId: q._id.toString(),
          questionTitle: q.title,
          questionType: 'scale',
          responseCount: 0,
          scaleMax: q.high || 5,
          ratingDistribution: [], // To be populated
          averageRating: 0
        });
      }
      // Logic for Multiple Choice questions
      else if (q.type === 'multiple_choice') {
        breakdownMap.set(q._id.toString(), {
          questionId: q._id.toString(),
          questionTitle: q.title,
          questionType: 'multiple_choice',
          responseCount: 0,
          optionDistribution: [] // To be populated
        });
      }
    });
  }

  // 2. Process responses to populate stats
  responses.forEach(response => {
    if (response.responses && Array.isArray(response.responses)) {
      response.responses.forEach(answer => {
        // Try fitting by ID first, then Title (as fallback)
        let qData = breakdownMap.get(answer.questionId);
        
        // If not found by ID, try finding by title in our map map
        // If not found by ID, try finding by title in our map (Robust Fallback)
        if (!qData) {
           for (const [key, val] of breakdownMap.entries()) {
             if (val.questionTitle === answer.questionTitle) {
               // SMART FALLBACK: Only match if the data types align
               // This prevents merging "Scale" answers into "Multiple Choice" questions with the same name
               
               const isScaleAnswer = !isNaN(Number(answer.answer));
               const isTextAnswer = typeof answer.answer === 'string';

               if (val.questionType === 'scale' && isScaleAnswer) {
                  qData = val;
                  break;
               } 
               else if (val.questionType === 'multiple_choice' && isTextAnswer) {
                  qData = val;
                  break;
               }
             }
           }
        }
        if (qData) {
          // Robust check for scale answers (can be number or numeric string)
          if (qData.questionType === 'scale') {
             const val = Number(answer.answer);
             if (!isNaN(val)) {
                qData.responseCount++;
                // Initialize distribution if empty
                if (qData.ratingDistribution.length === 0) {
                    const max = qData.scaleMax || 5;
                    for(let i=1; i<=max; i++) {
                      qData.ratingDistribution.push({ name: `${i} Star`, value: 0, count: 0 });
                    }
                }
                
                // Update count
                const ratingIndex = Math.floor(val) - 1;
                if (ratingIndex >= 0 && ratingIndex < qData.ratingDistribution.length) {
                  qData.ratingDistribution[ratingIndex].count++;
                }
             }
          }
          // Robust check for multiple choice (ensure it is a string)
          else if (qData.questionType === 'multiple_choice' && answer.answer) {
             const answerText = String(answer.answer); // Force to string
             qData.responseCount++;
             const existingOption = qData.optionDistribution.find(o => o.name === answerText);
             if (existingOption) {
               existingOption.count++;
             } else {
               qData.optionDistribution.push({ name: answerText, count: 1, value: 0 });
             }
          }
        }
      });
    }
  });

  // 3. Post-process: Calculate percentages and averages
  for (const qData of breakdownMap.values()) {
     if (qData.questionType === 'scale') {
        let sum = 0;
        let total = qData.responseCount;
        
        qData.ratingDistribution.forEach(dist => {
           // Provide safe calc for percentage
           dist.value = total > 0 ? Math.round((dist.count / total) * 100) : 0;
           // Hacky way to get rating value from name "5 Star" -> 5
           const ratingVal = parseInt(dist.name); 
           if (!isNaN(ratingVal)) {
              sum += ratingVal * dist.count;
           }
        });
        
        qData.averageRating = total > 0 ? sum / total : 0;
     } 
     else if (qData.questionType === 'multiple_choice') {
        let total = qData.responseCount;
        qData.optionDistribution.forEach(dist => {
           dist.value = total > 0 ? Math.round((dist.count / total) * 100) : 0;
        });
     }
  }

  // 4. Merge text analysis breakdown
  // Convert map to array and append text breakdown
  const combinedBreakdown = [...Array.from(breakdownMap.values())];
  
  if (textBreakdown && Array.isArray(textBreakdown)) {
    textBreakdown.forEach(item => {
      // Check if already exists (unlikely for text vs scale, but good safety)
      const existing = combinedBreakdown.find(
         x => x.questionId === item.questionId || x.questionTitle === item.questionTitle
      );
      if (!existing) {
        combinedBreakdown.push(item);
      }
    });
  }

  return combinedBreakdown;
}

module.exports = {
  getDynamicQuantitativeData,
  getDynamicQualitativeData,
  getDynamicCommentsData,
  getAllReportsWithLiveData,
  getSavedReports,
  generateReport,
  getDynamicColumnBreakdown,
  getColumnSuggestions,
};
