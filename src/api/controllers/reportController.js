const Form = require("../../models/Form");
const Report = require("../../models/Report");
const AnalysisService = require("../../services/analysis/analysisService");
const ThumbnailService = require("../../services/thumbnail/thumbnailService");
const mongoose = require("mongoose");
const { cache, invalidateCache } = require("../../utils/cache");

/**
 * Get dynamic quantitative data with filtering and date range
 */
const getDynamicQuantitativeData = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { startDate, endDate, ratingFilter, responseLimit, useSnapshot } =
      req.query;

    const userId = req.user._id;

    // Find the form
    const form = await Form.findById(reportId).populate(
      "createdBy",
      "name email role"
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
              (r) => r.value >= min && r.value <= max
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
          (r) => r.value >= min && r.value <= max
        );
      }
    }

    // Process data for charts
    const yearData = processYearlyDataFromForm(form, responses);
    const ratingDistribution = processRatingDistributionFromForm(
      filteredScaleResponses
    );
    const statusBreakdown = processStatusBreakdownFromForm(form);
    const responseTrends = processResponseTrendsFromForm(responses);

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

    // Check cache for live data requests (not snapshot)
    if (req.query.useSnapshot !== "true") {
      const cacheKey = `qualitative_${reportId}_${sentiment}_${keyword || ""}_${
        startDate || ""
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
      "name email role"
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
            categorizedComments: {
              positive: [],
              neutral: [],
              negative: [],
            },
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

    // Extract text responses
    const textResponses = extractTextResponses(responses);

    // Perform sentiment analysis
    const analysis = await AnalysisService.analyzeResponses(responses);

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
        (response.answer || "").toLowerCase().includes(keywordLower)
      );
    }

    // Categorize comments
    const categorizedComments = {
      positive: [],
      neutral: [],
      negative: [],
    };

    filteredTextResponses.slice(0, parseInt(limit)).forEach((response) => {
      const answer = response.answer || "";
      const text = answer.toLowerCase();

      let category = "neutral";
      const positiveKeywords = [
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
      ];
      const negativeKeywords = [
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
      ];

      const positiveMatches = positiveKeywords.filter((keyword) =>
        text.includes(keyword)
      ).length;
      const negativeMatches = negativeKeywords.filter((keyword) =>
        text.includes(keyword)
      ).length;

      if (positiveMatches > negativeMatches && positiveMatches > 0) {
        category = "positive";
      } else if (negativeMatches > positiveMatches && negativeMatches > 0) {
        category = "negative";
      }

      categorizedComments[category].push({
        id: response.id,
        comment: answer,
        user: response.respondentName || "Anonymous",
        email: response.respondentEmail,
        questionTitle: response.questionTitle,
        createdAt: response.submittedAt,
      });
    });

    // NEW: Build per-question breakdown
    const questionBreakdown = [];
    const questions = form.questions || [];

    questions.forEach((question) => {
      const questionId = question._id.toString();
      const questionTitle = question.title;
      const questionType = question.type;

      // Get all responses for this specific question
      const questionResponses = [];
      responses.forEach((response) => {
        if (response.responses && Array.isArray(response.responses)) {
          response.responses.forEach((ans) => {
            if (
              ans.questionId === questionId ||
              ans.questionTitle === questionTitle
            ) {
              questionResponses.push({
                answer: ans.answer,
                respondentName: response.respondentName,
                submittedAt: response.submittedAt,
              });
            }
          });
        }
      });

      const responseCount = questionResponses.length;

      if (questionType === "scale") {
        // For scale questions: show rating distribution
        const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        questionResponses.forEach((r) => {
          const rating = parseInt(r.answer) || 0;
          if (rating >= 1 && rating <= 5) {
            ratingCounts[rating]++;
          }
        });

        const ratingDistribution = Object.entries(ratingCounts).map(
          ([rating, count]) => ({
            name: `${rating} Star`,
            value:
              responseCount > 0 ? Math.round((count / responseCount) * 100) : 0,
            count: count,
          })
        );

        const avgRating =
          responseCount > 0
            ? questionResponses.reduce(
                (sum, r) => sum + (parseInt(r.answer) || 0),
                0
              ) / responseCount
            : 0;

        questionBreakdown.push({
          questionId,
          questionTitle,
          questionType,
          responseCount,
          ratingDistribution,
          averageRating: Math.round(avgRating * 100) / 100,
        });
      } else if (
        questionType === "paragraph" ||
        questionType === "short_answer"
      ) {
        // For text questions: show sentiment breakdown
        let positiveCount = 0;
        let neutralCount = 0;
        let negativeCount = 0;
        const sampleResponses = [];

        questionResponses.forEach((r, idx) => {
          const text = (r.answer || "").toLowerCase();
          const positiveKeywords = [
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
            "informative",
            "helpful",
          ];
          const negativeKeywords = [
            "bad",
            "terrible",
            "awful",
            "horrible",
            "hate",
            "dislike",
            "worst",
            "disappointed",
            "unsatisfied",
            "frustrated",
            "poor",
            "boring",
            "rushed",
            "confusing",
          ];

          const posMatches = positiveKeywords.filter((k) =>
            text.includes(k)
          ).length;
          const negMatches = negativeKeywords.filter((k) =>
            text.includes(k)
          ).length;

          let sentiment = "neutral";
          if (posMatches > 0 && negMatches > 0) {
            sentiment = "neutral"; // Mixed
            neutralCount++;
          } else if (posMatches > negMatches && posMatches > 0) {
            sentiment = "positive";
            positiveCount++;
          } else if (negMatches > posMatches && negMatches > 0) {
            sentiment = "negative";
            negativeCount++;
          } else {
            neutralCount++;
          }

          // Keep sample of responses (max 3 per sentiment)
          if (idx < 9) {
            sampleResponses.push({
              text: r.answer,
              sentiment,
              respondentName: r.respondentName || "Anonymous",
            });
          }
        });

        const total = positiveCount + neutralCount + negativeCount;
        const sentimentBreakdown = {
          positive: {
            count: positiveCount,
            percentage:
              total > 0 ? Math.round((positiveCount / total) * 100) : 0,
          },
          neutral: {
            count: neutralCount,
            percentage:
              total > 0 ? Math.round((neutralCount / total) * 100) : 0,
          },
          negative: {
            count: negativeCount,
            percentage:
              total > 0 ? Math.round((negativeCount / total) * 100) : 0,
          },
        };

        questionBreakdown.push({
          questionId,
          questionTitle,
          questionType,
          responseCount,
          sentimentBreakdown,
          sampleResponses: sampleResponses.slice(0, 6),
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
          })
        );

        questionBreakdown.push({
          questionId,
          questionTitle,
          questionType,
          responseCount,
          optionDistribution,
        });
      }
    });

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
      lastUpdated: new Date().toISOString(),
    };

    // Cache the qualitative data for 10 minutes (600 seconds)
    if (req.query.useSnapshot !== "true") {
      const cacheKey = `qualitative_${reportId}_${sentiment}_${keyword || ""}_${
        startDate || ""
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

    // Find the form
    const form = await Form.findById(reportId).populate(
      "createdBy",
      "name email role"
    );
    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    // Build base filter for responses
    let responses = form.responses || [];

    // Apply filters
    if (searchTerm) {
      responses = responses.filter((response) =>
        (response.answer || "").toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (dateRange) {
      const [start, end] = dateRange.split(",");
      if (start && end) {
        responses = responses.filter((response) => {
          const submittedAt = new Date(response.submittedAt);
          return submittedAt >= new Date(start) && submittedAt <= new Date(end);
        });
      }
    }

    // Get total count for pagination
    const totalCount = responses.length;

    // Sort responses
    responses.sort((a, b) => {
      const aValue = a[sortBy] || a.submittedAt;
      const bValue = b[sortBy] || b.submittedAt;
      return sortOrder === "asc"
        ? new Date(aValue) - new Date(bValue)
        : new Date(bValue) - new Date(aValue);
    });

    // Paginate results
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedResponses = responses.slice(skip, skip + parseInt(limit));

    // Process comments based on type
    let processedComments = paginatedResponses;
    if (type !== "all") {
      processedComments = paginatedResponses.filter((response) => {
        const text = (response.answer || "").toLowerCase();
        const positiveKeywords = [
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
        ];
        const negativeKeywords = [
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
        ];

        const positiveMatches = positiveKeywords.filter((keyword) =>
          text.includes(keyword)
        ).length;
        const negativeMatches = negativeKeywords.filter((keyword) =>
          text.includes(keyword)
        ).length;

        if (type === "positive") {
          return positiveMatches > negativeMatches && positiveMatches > 0;
        } else if (type === "negative") {
          return negativeMatches > positiveMatches && negativeMatches > 0;
        } else {
          return (
            (positiveMatches === 0 && negativeMatches === 0) ||
            positiveMatches === negativeMatches
          );
        }
      });
    }

    // Filter by role if specified (using attendee list)
    if (role && form.attendeeList) {
      processedComments = processedComments.filter((response) => {
        const attendee = form.attendeeList.find(
          (a) => a.email === response.respondentEmail
        );
        return attendee && attendee.userId && attendee.userId.role === role;
      });
    }

    const comments = processedComments.map((response) => ({
      id: response.id,
      comment: response.answer,
      user: response.respondentName || "Anonymous",
      email: response.respondentEmail,
      questionTitle: response.questionTitle,
      submittedAt: response.submittedAt,
    }));

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

        // Perform sentiment analysis (use Python for consistency)
        const responseAnalysis = await AnalysisService.analyzeResponses(
          form.responses || []
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
          form.responses || []
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
      })
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
    const responseAnalysis = await AnalysisService.analyzeResponses(
      form.responses || []
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

    // Generate thumbnail
    const thumbnail = await ThumbnailService.generateReportThumbnail(
      form._id,
      form.title || "Event Evaluation Report"
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
        },
      },
      // Create frozen snapshot of all data at generation time
      dataSnapshot: {
        responses: form.responses || [],
        scaleResponses: scaleResponses,
        textResponses: extractTextResponses(form.responses || []),
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
          },
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
function extractTextResponses(responses) {
  const textResponses = [];

  responses.forEach((response) => {
    if (response.responses) {
      response.responses.forEach((item) => {
        // Check if this is a text response
        if (typeof item.answer === "string" && item.answer.trim().length > 0) {
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

module.exports = {
  getDynamicQuantitativeData,
  getDynamicQualitativeData,
  getDynamicCommentsData,
  getAllReportsWithLiveData,
  getSavedReports,
  generateReport,
};
