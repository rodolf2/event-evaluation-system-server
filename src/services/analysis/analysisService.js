const Feedback = require("../../models/Feedback");
const Event = require("../../models/Event");
const Form = require("../../models/Form");
const Lexicon = require("../../models/Lexicon");
const mongoose = require("mongoose");
const path = require("path");
const { PythonShell } = require("python-shell");

/**
 * Calculates the average rating for a given event.
 * @param {string} eventId - The ID of the event to analyze.
 * @returns {Promise<number>} The average rating for the event.
 */
const getAverageRating = async (eventId) => {
  const averageRating = await Feedback.aggregate([
    { $match: { eventId: eventId } },
    { $group: { _id: "$eventId", avgRating: { $avg: "$rating" } } },
  ]);

  return averageRating.length > 0 ? averageRating[0].avgRating : 0;
};

const generateQualitativeReport = async (eventId) => {
  const feedbacks = await Feedback.find({ eventId });

  if (feedbacks.length === 0) {
    return {
      summary: { positive: 0, neutral: 0, negative: 0 },
      insights: "No feedback available to generate insights.",
      recommendations: "Encourage participants to provide feedback.",
      comments: { positive: [], neutral: [], negative: [] },
    };
  }

  // Extract comments from feedbacks
  const comments = feedbacks
    .map((fb) => fb.comment)
    .filter((comment) => comment && comment.trim());

  if (comments.length === 0) {
    return {
      summary: { positive: 0, neutral: 0, negative: 0 },
      insights: "No valid feedback comments available to generate insights.",
      recommendations: "Encourage participants to provide detailed feedback.",
      comments: { positive: [], neutral: [], negative: [] },
    };
  }

  // Fetch lexicon keywords from database
  let dbLexicon = [];
  try {
    dbLexicon = await Lexicon.find();
  } catch (lexError) {
    console.warn(
      "Failed to fetch lexicon from DB, using fallback defaults:",
      lexError.message,
    );
  }

  try {
    // Call Python script for advanced multilingual sentiment analysis
    const pythonResult = await new Promise((resolve, reject) => {
      const scriptPath = path.resolve(__dirname, "../../../text_analysis.py");

      // Try to find the python executable in venv, otherwise fall back to system python
      let pythonPath;
      const venvPathWin = path.resolve(
        __dirname,
        "../../../venv",
        "Scripts",
        "python.exe",
      );
      const venvPathUnix = path.resolve(
        __dirname,
        "../../../venv",
        "bin",
        "python",
      );

      if (
        process.platform === "win32" &&
        require("fs").existsSync(venvPathWin)
      ) {
        pythonPath = venvPathWin;
      } else if (
        process.platform !== "win32" &&
        require("fs").existsSync(venvPathUnix)
      ) {
        pythonPath = venvPathUnix;
      } else {
        // Fallback to system python
        pythonPath = "python";
      }

      console.log("Calling Python script for sentiment analysis:", scriptPath);
      console.log("Python path:", pythonPath);
      console.log("Number of comments to analyze:", comments.length);

      const pyshell = new PythonShell(scriptPath, {
        pythonPath,
        pythonOptions: ["-u"], // Unbuffered output
      });

      // Send data to Python script
      pyshell.send(
        JSON.stringify({
          action: "generate_report",
          feedbacks: comments,
          lexicon: dbLexicon,
        }),
      );

      let result = "";
      let errorOutput = "";

      pyshell.on("message", (message) => {
        result += message;
      });

      pyshell.on("stderr", (stderr) => {
        errorOutput += stderr;
        console.log("Python stderr:", stderr);
      });

      pyshell.end((err) => {
        if (err) {
          console.error("Python script error:", err);
          console.error("Python stderr output:", errorOutput);
          reject(err);
        } else {
          try {
            const parsedResult = JSON.parse(result);
            console.log("Python analysis completed successfully");
            console.log("Analysis summary:", parsedResult.summary);
            resolve(parsedResult);
          } catch (parseErr) {
            console.error("Failed to parse Python result:", parseErr);
            console.error("Raw result:", result);
            reject(parseErr);
          }
        }
      });
    });

    // Transform Python result to match expected format
    if (pythonResult.success) {
      return {
        summary: pythonResult.summary,
        insights: generateInsights(pythonResult),
        recommendations: generateRecommendations(pythonResult),
        comments: pythonResult.categorized_comments,
        analyzed_feedbacks: pythonResult.analyzed_feedbacks,
        language_breakdown: pythonResult.language_breakdown,
      };
    } else {
      throw new Error(pythonResult.error || "Python analysis failed");
    }
  } catch (error) {
    // Enhanced fallback logging - make it very visible
    console.warn("⚠️ ============================================== ⚠️");
    console.warn("⚠️  PYTHON SENTIMENT ANALYSIS FAILED - USING FALLBACK");
    console.warn("⚠️ ============================================== ⚠️");
    console.error(
      "Error calling Python script for qualitative analysis:",
      error,
    );
    console.error("Error details:", error.message);
    console.warn("Fallback reason:", error.message || "Unknown error");
    console.warn("Timestamp:", new Date().toISOString());
    console.warn("Comments to analyze:", comments.length);
    console.log("🔄 Falling back to enhanced JavaScript sentiment analysis...");

    // Pass the fallback reason to include in the response
    return await enhancedQualitativeAnalysis(
      comments,
      dbLexicon,
      error.message || "Python script execution failed",
    );
  }
};

const generateQuantitativeReport = async (eventId) => {
  const currentEvent = await Event.findById(eventId);
  if (!currentEvent) {
    throw new Error("Event not found");
  }

  // Find the corresponding event from the previous year
  const lastYear = new Date(currentEvent.date);
  lastYear.setFullYear(lastYear.getFullYear() - 1);

  const previousEvent = await Event.findOne({
    name: currentEvent.name,
    date: {
      $gte: new Date(lastYear.getFullYear(), 0, 1),
      $lt: new Date(lastYear.getFullYear() + 1, 0, 1),
    },
  });

  // Get current year feedback data
  const currentYearFeedbacks = await Feedback.find({
    eventId: new mongoose.Types.ObjectId(eventId),
  });
  const currentYearData = {
    ratings: currentYearFeedbacks
      .map((fb) => fb.rating)
      .filter((r) => r != null),
    responseCount: currentYearFeedbacks.length,
  };

  let previousYearData = { ratings: [], responseCount: 0 };
  if (previousEvent) {
    const previousYearFeedbacks = await Feedback.find({
      eventId: previousEvent._id,
    });
    previousYearData = {
      ratings: previousYearFeedbacks
        .map((fb) => fb.rating)
        .filter((r) => r != null),
      responseCount: previousYearFeedbacks.length,
    };
  }

  try {
    // Use Python for statistical analysis
    const quantitativeResult = await new Promise((resolve, reject) => {
      const scriptPath = path.resolve(__dirname, "../../../text_analysis.py");

      // Try to find the python executable in venv, otherwise fall back to system python
      let pythonPath;
      const venvPathWin = path.resolve(
        __dirname,
        "../../../venv",
        "Scripts",
        "python.exe",
      );
      const venvPathUnix = path.resolve(
        __dirname,
        "../../../venv",
        "bin",
        "python",
      );

      if (
        process.platform === "win32" &&
        require("fs").existsSync(venvPathWin)
      ) {
        pythonPath = venvPathWin;
      } else if (
        process.platform !== "win32" &&
        require("fs").existsSync(venvPathUnix)
      ) {
        pythonPath = venvPathUnix;
      } else {
        // Fallback to system python
        pythonPath = "python";
      }
      const pyshell = new PythonShell(scriptPath, { pythonPath });

      pyshell.send(
        JSON.stringify({
          action: "analyze_quantitative",
          currentYearData: currentYearData,
          previousYearData: previousYearData,
          currentYear: currentEvent.date.getFullYear(),
          previousYear: previousEvent
            ? previousEvent.date.getFullYear()
            : lastYear.getFullYear(),
        }),
      );

      let result = "";
      pyshell.on("message", (message) => {
        result += message;
      });

      pyshell.end((err) => {
        if (err) {
          reject(err);
        } else {
          try {
            resolve(JSON.parse(result));
          } catch (parseErr) {
            reject(parseErr);
          }
        }
      });
    });

    return quantitativeResult;
  } catch (error) {
    console.error("Error calling Python quantitative analysis:", error);

    // Fallback to basic calculations if Python script fails
    const calculateStats = (ratings) => {
      if (ratings.length === 0) return { avgRating: 0, responseCount: 0 };
      const sum = ratings.reduce((a, b) => a + b, 0);
      return {
        avgRating: sum / ratings.length,
        responseCount: ratings.length,
      };
    };

    const currentStats = calculateStats(currentYearData.ratings);
    const previousStats = calculateStats(previousYearData.ratings);

    return {
      currentYear: {
        year: currentEvent.date.getFullYear(),
        averageRating: currentStats.avgRating,
        responseCount: currentStats.responseCount,
      },
      previousYear: {
        year: previousEvent
          ? previousEvent.date.getFullYear()
          : lastYear.getFullYear(),
        averageRating: previousStats.avgRating,
        responseCount: previousStats.responseCount,
      },
    };
  }
};

/**
 * Generate insights based on sentiment analysis results
 */
function generateInsights(analysisResult) {
  const { summary, analyzed_feedbacks } = analysisResult;
  const total = analyzed_feedbacks.length;

  if (total === 0) {
    return "No feedback data available for analysis.";
  }

  let insights = [];

  // Overall sentiment insights
  const positivePercent = summary.positive.percentage;
  const negativePercent = summary.negative.percentage;
  const neutralPercent = summary.neutral.percentage;

  if (positivePercent > 60) {
    insights.push(
      `Excellent feedback received with ${positivePercent}% positive sentiment, indicating high satisfaction with the event.`,
    );
  } else if (positivePercent > 40) {
    insights.push(
      `Generally positive feedback with ${positivePercent}% positive sentiment, showing good overall satisfaction.`,
    );
  } else if (negativePercent > 30) {
    insights.push(
      `Areas of concern identified with ${negativePercent}% negative sentiment that require attention.`,
    );
  }

  // Language insights
  const englishCount = analyzed_feedbacks.filter(
    (f) => f.analysis.language?.language === "en",
  ).length;
  const tagalogCount = analyzed_feedbacks.filter(
    (f) => f.analysis.language?.language === "tl",
  ).length;

  if (englishCount > 0 && tagalogCount > 0) {
    insights.push(
      `Multilingual feedback received: ${englishCount} English and ${tagalogCount} Tagalog comments analyzed.`,
    );
  }

  // Confidence insights
  const highConfidence = analyzed_feedbacks.filter(
    (f) => f.analysis.confidence > 0.7,
  ).length;
  const confidenceRate = ((highConfidence / total) * 100).toFixed(1);

  insights.push(
    `Analysis confidence: ${confidenceRate}% of feedback was analyzed with high confidence using advanced multilingual sentiment analysis.`,
  );

  return insights.join(" ");
}

/**
 * Generate recommendations based on sentiment analysis
 */
function generateRecommendations(analysisResult) {
  const { summary, analyzed_feedbacks } = analysisResult;
  const recommendations = [];

  const positivePercent = summary.positive.percentage;
  const negativePercent = summary.negative.percentage;

  if (negativePercent > 20) {
    recommendations.push(
      "Address negative feedback promptly to improve future events.",
    );
    recommendations.push(
      "Consider follow-up surveys to understand specific concerns mentioned.",
    );
  }

  if (positivePercent > 70) {
    recommendations.push(
      "Continue successful practices that contributed to high satisfaction.",
    );
    recommendations.push(
      "Use positive feedback examples in future event planning.",
    );
  }

  if (analyzed_feedbacks.some((f) => f.analysis.language?.language === "tl")) {
    recommendations.push(
      "Ensure multilingual support in future communications and surveys.",
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("Maintain current event quality standards.");
    recommendations.push(
      "Continue gathering detailed feedback for continuous improvement.",
    );
  }

  return recommendations.join(" ");
}

/**
 * Enhanced JavaScript qualitative analysis with multilingual support
 * @param {string[]} comments - Array of comments to analyze
 * @param {Array} dbLexicon - Optional lexicon keywords from DB
 * @param {string} fallbackReason - Optional reason why Python fallback was triggered
 */
async function enhancedQualitativeAnalysis(
  comments,
  dbLexicon = [],
  fallbackReason = null,
) {
  console.warn("⚠️ Using JavaScript fallback for sentiment analysis");
  console.log(
    "🔄 Using enhanced JavaScript sentiment analysis with multilingual support",
  );
  if (fallbackReason) {
    console.warn("Fallback triggered because:", fallbackReason);
  }

  const categorized_comments = {
    positive: [],
    negative: [],
    neutral: [],
  };

  const sentiment_counts = {
    positive: 0,
    negative: 0,
    neutral: 0,
  };

  // Comprehensive multilingual sentiment lexicon
  let multilingualKeywords = {
    positive: { english: [], tagalog: [] },
    negative: { english: [], tagalog: [] },
    neutral: { english: [], tagalog: [] },
    contrastIndicators: { english: [], tagalog: [] },
    intensifiers: { english: [], tagalog: [] },
  };

  // Fallback defaults if DB is empty
  const fallbackLexicon = {
    positive: {
      english: [
        "good",
        "great",
        "excellent",
        "amazing",
        "wonderful",
        "fantastic",
        "awesome",
        "perfect",
        "love",
        "enjoy",
        "helpful",
        "well-organized",
      ],
      tagalog: [
        "maganda",
        "mahusay",
        "galing",
        "ayos",
        "sulit",
        "masaya",
        "napakaganda",
        "sobrang ganda",
        "maraming salamat",
      ],
    },
    negative: {
      english: [
        "bad",
        "terrible",
        "awful",
        "horrible",
        "hate",
        "worst",
        "disappointed",
        "boring",
        "disorganized",
        "waste of time",
      ],
      tagalog: [
        "masama",
        "pangit",
        "nakakainis",
        "galit",
        "walang kwenta",
        "sayang",
        "hindi maganda",
      ],
    },
    neutral: {
      english: ["okay", "fine", "alright", "normal", "average"],
      tagalog: ["okay lang", "ayos lang", "pwede na", "sakto lang"],
    },
    contrastIndicators: {
      english: [
        "but",
        "however",
        "although",
        "though",
        "yet",
        "still",
        "despite",
        "unfortunately",
      ],
      tagalog: [
        "pero",
        "ngunit",
        "subalit",
        "kahit",
        "gayunpaman",
        "kaya lang",
        "sayang lang",
      ],
    },
    intensifiers: {
      english: [
        "very",
        "extremely",
        "really",
        "so",
        "absolutely",
        "totally",
        "highly",
        "incredibly",
      ],
      tagalog: [
        "napaka",
        "sobra",
        "sobrang",
        "labis",
        "lubos",
        "grabe",
        "talagang",
      ],
    },
  };

  // Merge DB lexicon or use fallbacks
  if (dbLexicon && dbLexicon.length > 0) {
    dbLexicon.forEach((item) => {
      const type = item.sentiment;
      const lang = item.language === "en" ? "english" : "tagalog";
      // Handle contrastIndicators and intensifiers if they were stored in DB (they currently aren't, but let's be flexible)
      if (multilingualKeywords[type] && multilingualKeywords[type][lang]) {
        multilingualKeywords[type][lang].push(item.word);
      }
    });

    // Always add core contrast and intensifiers to the working set from fallbacks
    // since they aren't in the DB yet
    multilingualKeywords.contrastIndicators =
      fallbackLexicon.contrastIndicators;
    multilingualKeywords.intensifiers = fallbackLexicon.intensifiers;
    // Add neutral fallback if DB doesn't have neutral words
    if (multilingualKeywords.neutral.english.length === 0) {
      multilingualKeywords.neutral = fallbackLexicon.neutral;
    }
  } else {
    multilingualKeywords = fallbackLexicon;
  }

  // Language detection patterns
  const languagePatterns = {
    tagalog:
      /\b(ang|ng|sa|kay|ko|mo|nya|kami|kayo|sila|ito|dito|doon|talaga|nga|naman|rin|din|pa|po|ba|ako|ikaw|siya)\b/i,
    english:
      /\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by|is|are|was|were|be|been|have|has|had|do|does|did|will|would|can|could)\b/i,
  };

  comments.forEach((comment) => {
    if (!comment || !comment.trim()) return;

    const text = comment.toLowerCase();

    // Language detection
    const hasTagalog = languagePatterns.tagalog.test(text);
    const hasEnglish = languagePatterns.english.test(text);
    const language =
      hasTagalog && !hasEnglish
        ? "tagalog"
        : hasEnglish && !hasTagalog
          ? "english"
          : "mixed";

    let positiveScore = 0;
    let negativeScore = 0;
    let neutralScore = 0;
    let intensifierMultiplier = 1;

    // Intensifiers
    const allIntensifiers = [
      ...multilingualKeywords.intensifiers.english,
      ...multilingualKeywords.intensifiers.tagalog,
    ];
    const intensifierCount = allIntensifiers.filter((i) =>
      text.includes(i),
    ).length;
    if (intensifierCount > 0)
      intensifierMultiplier = 1 + intensifierCount * 0.3;

    // Sentiment Scores
    const posKeys = [
      ...multilingualKeywords.positive.english,
      ...multilingualKeywords.positive.tagalog,
    ];
    positiveScore =
      posKeys.filter((k) => text.includes(k)).length * intensifierMultiplier;

    const negKeys = [
      ...multilingualKeywords.negative.english,
      ...multilingualKeywords.negative.tagalog,
    ];
    negativeScore =
      negKeys.filter((k) => text.includes(k)).length * intensifierMultiplier;

    const neuKeys = [
      ...multilingualKeywords.neutral.english,
      ...multilingualKeywords.neutral.tagalog,
    ];
    neutralScore = neuKeys.filter((k) => text.includes(k)).length;

    // Contrast Check
    const contrastKeys = [
      ...multilingualKeywords.contrastIndicators.english,
      ...multilingualKeywords.contrastIndicators.tagalog,
    ];
    const hasContrast = contrastKeys.some((k) => text.includes(k));

    // Classification logic
    let sentiment = "neutral";
    let confidence = 0.5;

    if (
      (positiveScore > 0 && negativeScore > 0) ||
      (hasContrast && (positiveScore > 0 || negativeScore > 0))
    ) {
      sentiment = "neutral";
      confidence = 0.6;
    } else if (positiveScore > negativeScore) {
      sentiment = "positive";
      confidence = Math.min(0.5 + positiveScore * 0.1, 0.95);
    } else if (negativeScore > positiveScore) {
      sentiment = "negative";
      confidence = Math.min(0.5 + negativeScore * 0.1, 0.95);
    } else if (neutralScore > 0) {
      sentiment = "neutral";
      confidence = 0.7;
    }

    categorized_comments[sentiment].push({
      text: comment,
      analysis: {
        sentiment,
        confidence,
        language,
        method: "enhanced_javascript_multilingual",
        scores: { positive: positiveScore, negative: negativeScore },
      },
    });
    sentiment_counts[sentiment]++;
  });

  const total = comments.length;
  const summary = {};
  ["positive", "negative", "neutral"].forEach((s) => {
    const count = sentiment_counts[s];
    summary[s] = {
      count,
      percentage: total > 0 ? Math.round((count / total) * 100 * 100) / 100 : 0,
    };
  });

  return {
    summary,
    insights: generateEnhancedInsights(summary, comments),
    recommendations: generateEnhancedRecommendations(summary),
    comments: categorized_comments,
    analysis_method: "enhanced_javascript_multilingual",
    fallback_used: true,
    fallback_reason: fallbackReason,
    fallback_timestamp: new Date().toISOString(),
  };
}

/**
 * Generate enhanced insights for multilingual analysis
 */
function generateEnhancedInsights(summary, comments) {
  const total = comments.length;
  const positivePercent = summary.positive.percentage;
  const negativePercent = summary.negative.percentage;

  let insights = [];

  if (positivePercent > 60) {
    insights.push(
      `Excellent multilingual feedback received with ${positivePercent}% positive sentiment, indicating high satisfaction across English and Tagalog responses.`,
    );
  } else if (positivePercent > 40) {
    insights.push(
      `Generally positive multilingual feedback with ${positivePercent}% positive sentiment, showing good overall satisfaction.`,
    );
  } else if (negativePercent > 30) {
    insights.push(
      `Areas of concern identified with ${negativePercent}% negative sentiment that require attention in both languages.`,
    );
  }

  // Language diversity insights
  const englishComments = comments.filter(
    (c) =>
      c &&
      c
        .toLowerCase()
        .match(/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by)\b/i),
  ).length;
  const tagalogComments = comments.filter(
    (c) => c && c.toLowerCase().match(/\b(ang|ng|sa|kay|ko|mo|nya)\b/i),
  ).length;

  if (englishComments > 0 && tagalogComments > 0) {
    const englishPercent = Math.round((englishComments / total) * 100);
    const tagalogPercent = Math.round((tagalogComments / total) * 100);
    insights.push(
      `Multilingual feedback received: approximately ${englishPercent}% English and ${tagalogPercent}% Tagalog responses analyzed.`,
    );
  }

  insights.push(
    `Enhanced sentiment analysis completed with multilingual keyword detection and confidence scoring.`,
  );

  return insights.join(" ");
}

/**
 * Generate enhanced recommendations
 */
function generateEnhancedRecommendations(summary) {
  const recommendations = [];
  const positivePercent = summary.positive.percentage;
  const negativePercent = summary.negative.percentage;

  if (negativePercent > 20) {
    recommendations.push(
      "Address negative feedback promptly to improve future events.",
    );
    recommendations.push(
      "Consider follow-up surveys in both English and Tagalog to understand specific concerns.",
    );
  }

  if (positivePercent > 70) {
    recommendations.push(
      "Continue successful practices that contributed to high satisfaction.",
    );
    recommendations.push(
      "Use positive feedback examples in future multilingual communications.",
    );
  }

  recommendations.push(
    "Maintain multilingual support in surveys and communications.",
  );
  recommendations.push(
    "Continue gathering detailed feedback for continuous improvement.",
  );

  return recommendations.join(" ");
}

module.exports = {
  getAverageRating,
  generateQualitativeReport,
  generateQuantitativeReport,
  analyzeResponses,
  generateResponseOverview,
  analyzeCommentSentiment,
};

/**
 * Analyzes form responses for sentiment and breakdown using Python
 * @param {boolean} usePython - Whether to use Python for analysis (default: true)
 * @returns {Object} Analysis results with sentiment breakdown
 */
async function analyzeResponses(
  responses,
  usePython = true,
  questionTypeMap = null,
) {
  if (!responses || responses.length === 0) {
    return {
      sentimentBreakdown: {
        positive: { count: 0, percentage: 0 },
        neutral: { count: 0, percentage: 0 },
        negative: { count: 0, percentage: 0 },
      },
    };
  }

  // If usePython is false, skip directly to fallback
  if (!usePython) {
    return fallbackAnalyzeResponses(responses);
  }

  try {
    // Extract text content from responses (only text-based questions, not ratings)
    const textContents = [];

    responses.forEach((response) => {
      if (response.responses && Array.isArray(response.responses)) {
        // Extract text from text-based questions only
        response.responses.forEach((q) => {
          // Skip if answer is a number (scale/rating)
          if (typeof q.answer === "number") return;

          // Skip if answer is a short numeric string (1-5 rating stored as string)
          if (typeof q.answer === "string") {
            const trimmed = q.answer.trim();
            // Skip pure numbers or very short responses (likely ratings)
            if (/^\d+$/.test(trimmed) && trimmed.length <= 2) return;
            // Skip if too short to be meaningful text (less than 3 characters)
            if (trimmed.length < 3) return;

            // This is actual text content
            if (questionTypeMap) {
              const qType =
                questionTypeMap[q.questionId] || questionTypeMap[q.questionTitle];
              if (qType === "paragraph" || qType === "short_answer") {
                textContents.push(trimmed);
              }
            } else {
              textContents.push(trimmed);
            }
          }

          // Handle array answers (multiple choice selections - skip for sentiment)
          // We don't analyze multiple choice for sentiment
        });
      }
    });

    if (textContents.length === 0) {
      return {
        sentimentBreakdown: {
          positive: { count: 0, percentage: 0 },
          neutral: { count: 0, percentage: 0 },
          negative: { count: 0, percentage: 0 },
        },
      };
    }

    // Call Python script for advanced sentiment analysis
    const pythonResult = await new Promise((resolve, reject) => {
      const scriptPath = path.resolve(__dirname, "../../../text_analysis.py");

      // Try to find the python executable in venv, otherwise fall back to system python
      let pythonPath;
      const venvPathWin = path.resolve(
        __dirname,
        "../../../venv",
        "Scripts",
        "python.exe",
      );
      const venvPathUnix = path.resolve(
        __dirname,
        "../../../venv",
        "bin",
        "python",
      );

      if (
        process.platform === "win32" &&
        require("fs").existsSync(venvPathWin)
      ) {
        pythonPath = venvPathWin;
      } else if (
        process.platform !== "win32" &&
        require("fs").existsSync(venvPathUnix)
      ) {
        pythonPath = venvPathUnix;
      } else {
        // Fallback to system python
        pythonPath = "python";
      }

      const pyshell = new PythonShell(scriptPath, {
        pythonPath,
        pythonOptions: ["-u"],
      });

      pyshell.send(
        JSON.stringify({
          action: "generate_report",
          feedbacks: textContents,
        }),
      );

      let result = "";
      pyshell.on("message", (message) => {
        result += message;
      });

      pyshell.on("stderr", (stderr) => {
        console.log("Python stderr (analyzeResponses):", stderr);
      });

      pyshell.end((err) => {
        if (err) {
          reject(err);
        } else {
          try {
            resolve(JSON.parse(result));
          } catch (parseErr) {
            reject(parseErr);
          }
        }
      });
    });

    if (pythonResult.success) {
      return {
        sentimentBreakdown: pythonResult.summary,
        analyzed_responses: pythonResult.analyzed_feedbacks,
        method: "python_advanced",
      };
    } else {
      throw new Error(pythonResult.error || "Python analysis failed");
    }
  } catch (error) {
    console.error("Error in analyzeResponses:", error.message);
    // Fallback to simple JavaScript analysis
    return fallbackAnalyzeResponses(responses, questionTypeMap);
  }
}

/**
 * Fallback JavaScript analysis for form responses
 */
function fallbackAnalyzeResponses(responses, questionTypeMap = null) {
  console.log("Using JavaScript fallback for response analysis");

  let positiveCount = 0;
  let neutralCount = 0;
  let negativeCount = 0;

  // Negation patterns that flip sentiment
  const negationPatterns = [
    "hindi naging maayos",
    "hindi maayos",
    "hindi maganda",
    "hindi malinaw",
    "hindi organized",
    "hindi okay",
    "hindi ayos",
    "di maayos",
    "di maganda",
    "not good",
    "not great",
    "not well",
    "not organized",
    "wasn't good",
    "wasn't great",
    "did not",
    "didn't",
    "couldn't",
  ];

  // Neutral/mixed indicators
  const neutralIndicators = [
    "average",
    "okay lang",
    "pwede na",
    "katamtaman",
    "sige lang",
    "could be improved",
    "could be better",
    "room for improvement",
    "some parts were",
    "while others",
    "pero may",
    "ngunit may",
    "pwede pang",
    "may improvement",
    "need improvement",
    "not bad",
    "so-so",
    "fair",
    "decent",
    "acceptable",
  ];

  const positiveKeywords = [
    "well-organized",
    "well organized",
    "enjoyable",
    "valuable",
    "knowledgeable",
    "engaging",
    "interested",
    "interesting",
    "good",
    "great",
    "excellent",
    "amazing",
    "wonderful",
    "fantastic",
    "love",
    "best",
    "awesome",
    "perfect",
    "satisfied",
    "happy",
    "pleased",
    "informative",
    "helpful",
    "enjoyed",
    "recommend",
    "thank",
    "thanks",
    "successful",
    "smooth",
    "professional",
    "maganda",
    "mabuti",
    "mahusay",
    "galing",
    "napakaganda",
    "napakagaling",
    "sobrang ganda",
    "sobrang galing",
    "masaya",
    "natutunan",
    "salamat",
    "sulit",
    "organisado",
    "maayos",
    "malinaw",
    "kapaki-pakinabang",
    "naging masaya",
  ];

  const negativeKeywords = [
    "lacked",
    "lacking",
    "late",
    "unclear",
    "difficult",
    "hard",
    "confusing",
    "confused",
    "poorly",
    "poor",
    "bad",
    "terrible",
    "awful",
    "horrible",
    "hate",
    "dislike",
    "worst",
    "disappointed",
    "disappointing",
    "unsatisfied",
    "frustrated",
    "boring",
    "waste",
    "disorganized",
    "unprepared",
    "crowded",
    "chaotic",
    "messy",
    "problem",
    "issue",
    "concern",
    "failed",
    "failure",
    "hindi naging maayos",
    "kakulangan",
    "nahirapan",
    "magulo",
    "hindi malinaw",
    "masama",
    "pangit",
    "nakakadismaya",
    "dismayado",
    "nakakainis",
    "nakakaasar",
    "badtrip",
    "sayang",
    "walang kwenta",
    "hindi maganda",
    "hindi okay",
    "kulang",
    "mali",
  ];

  responses.forEach((response) => {
    if (response.responses && Array.isArray(response.responses)) {
      response.responses.forEach((q) => {
        if (typeof q.answer === "number") return;

        if (typeof q.answer === "string") {
          const trimmed = q.answer.trim();
          if (/^\d+$/.test(trimmed) && trimmed.length <= 2) return;
          if (trimmed.length < 3) return;

          const textContent = trimmed.toLowerCase();

          // Apply question type filter if available
          if (questionTypeMap) {
            const qType =
              questionTypeMap[q.questionId] || questionTypeMap[q.questionTitle];
            if (qType !== "paragraph" && qType !== "short_answer") return;
          }

          // Check for negation patterns
          const hasNegationPattern = negationPatterns.some((pattern) =>
            textContent.includes(pattern),
          );

          // Check for neutral/mixed indicators
          const hasNeutralIndicator = neutralIndicators.some((indicator) =>
            textContent.includes(indicator),
          );

          const positiveMatches = positiveKeywords.filter((keyword) =>
            textContent.includes(keyword),
          ).length;
          const negativeMatches = negativeKeywords.filter((keyword) =>
            textContent.includes(keyword),
          ).length;

          // Determine sentiment with improved logic
          if (hasNegationPattern) {
            negativeCount++;
          } else if (
            hasNeutralIndicator &&
            positiveMatches > 0 &&
            positiveMatches <= 2
          ) {
            neutralCount++;
          } else if (negativeMatches > positiveMatches && negativeMatches > 0) {
            negativeCount++;
          } else if (
            positiveMatches > negativeMatches &&
            positiveMatches > 0 &&
            !hasNeutralIndicator
          ) {
            positiveCount++;
          } else if (hasNeutralIndicator) {
            neutralCount++;
          } else if (positiveMatches > 0 && negativeMatches === 0) {
            positiveCount++;
          } else {
            neutralCount++;
          }
        }
      });
    }
  });

  const total = positiveCount + neutralCount + negativeCount;
  return {
    sentimentBreakdown: {
      positive: {
        count: positiveCount,
        percentage:
          total > 0 ? Math.round((positiveCount / total) * 100 * 100) / 100 : 0,
      },
      neutral: {
        count: neutralCount,
        percentage:
          total > 0 ? Math.round((neutralCount / total) * 100 * 100) / 100 : 0,
      },
      negative: {
        count: negativeCount,
        percentage:
          total > 0 ? Math.round((negativeCount / total) * 100 * 100) / 100 : 0,
      },
    },
    method: "javascript_fallback",
  };
}

/**
 * Generates time series data for response overview
 * @param {Array} responses - Array of form responses
 * @param {Date} startDate - Start date for the time series (optional)
 * @param {Date} endDate - End date for the time series (optional)
 * @returns {Object} Time series data for charts
 */
function generateResponseOverview(responses, startDate = null, endDate = null) {
  if (!responses || responses.length === 0) {
    return {
      labels: [],
      data: [],
      dateRange: "No responses available",
    };
  }

  // Default date range: from form creation to now or last response
  const dates = responses
    .map((r) => new Date(r.submittedAt))
    .filter((d) => !isNaN(d));
  if (dates.length === 0) {
    return {
      labels: [],
      data: [],
      dateRange: "No response dates available",
    };
  }

  const minDate = startDate || new Date(Math.min(...dates));
  const maxDate = endDate || new Date(Math.max(...dates));

  // Generate weekly buckets
  const weekLabels = [];
  const weekData = [];
  const current = new Date(minDate);
  const end = new Date(maxDate);

  // Set to start of week (Monday)
  const dayOfWeek = current.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  current.setDate(current.getDate() - daysToMonday);
  current.setHours(0, 0, 0, 0);

  while (current <= end) {
    const weekStart = new Date(current);
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Count responses in this week
    const weekResponses = responses.filter((r) => {
      const responseDate = new Date(r.submittedAt);
      return responseDate >= weekStart && responseDate <= weekEnd;
    });

    // Format label
    const month = weekStart.toLocaleDateString("en-US", { month: "short" });
    const day = weekStart.getDate();
    weekLabels.push(`${month} ${day}`);

    // Count cumulative responses up to this week
    const cumulativeCount = responses.filter((r) => {
      const responseDate = new Date(r.submittedAt);
      return responseDate <= weekEnd;
    }).length;

    weekData.push(cumulativeCount);

    // Move to next week
    current.setDate(current.getDate() + 7);
  }

  // Format date range string
  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return {
    labels: weekLabels,
    data: weekData,
    dateRange: `${formatDate(minDate)} - ${formatDate(maxDate)}`,
  };
}

// ============================================================
// UNIFIED SENTIMENT ANALYSIS - Single Source of Truth
// ============================================================

// In-memory cache for sentiment analysis results (LRU-style)
const sentimentCache = new Map();
const CACHE_MAX_SIZE = 1000;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get Python path for sentiment analysis
 */
function getPythonPath() {
  const fs = require("fs");
  const venvPathWin = path.resolve(
    __dirname,
    "../../../venv",
    "Scripts",
    "python.exe",
  );
  const venvPathUnix = path.resolve(
    __dirname,
    "../../../venv",
    "bin",
    "python",
  );

  if (process.platform === "win32" && fs.existsSync(venvPathWin)) {
    return venvPathWin;
  } else if (process.platform !== "win32" && fs.existsSync(venvPathUnix)) {
    return venvPathUnix;
  }
  return "python";
}

/**
 * Analyze a single comment using Python (primary) with JavaScript fallback
 * This is the SINGLE SOURCE OF TRUTH for sentiment analysis
 * @param {string} text - The comment text to analyze
 * @returns {Promise<{sentiment: string, confidence: number, method: string}>}
 */
async function analyzeCommentSentiment(text) {
  if (!text || !text.trim()) {
    return { sentiment: "neutral", confidence: 0, method: "empty_text" };
  }

  const cleanText = text.trim();
  const cacheKey = cleanText.toLowerCase();

  // Check cache first
  if (sentimentCache.has(cacheKey)) {
    const cached = sentimentCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.result;
    }
    sentimentCache.delete(cacheKey); // Expired
  }

  let result;
  let dbLexicon = [];

  try {
    // Fetch lexicon to pass to Python for custom word support
    dbLexicon = await Lexicon.find().lean();

    // Try Python analysis first (most accurate)
    result = await analyzeSingleWithPython(cleanText, dbLexicon);
  } catch (error) {
    console.log(
      `[SENTIMENT] Python failed for "${cleanText.substring(0, 30)}...": ${error.message
      }`,
    );
    // Fallback to JavaScript
    result = analyzeWithJavaScript(cleanText);
  }

  // Cache the result
  if (sentimentCache.size >= CACHE_MAX_SIZE) {
    // Remove oldest entry (FIFO)
    const firstKey = sentimentCache.keys().next().value;
    sentimentCache.delete(firstKey);
  }
  sentimentCache.set(cacheKey, { result, timestamp: Date.now() });

  return result;
}

/**
 * Analyze single comment with Python
 * @param {string} text - The comment text
 * @param {Array} lexicon - Custom lexicon from DB
 */
async function analyzeSingleWithPython(text, lexicon = []) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(__dirname, "../../../text_analysis.py");
    const pythonPath = getPythonPath();

    const pyshell = new PythonShell(scriptPath, {
      pythonPath,
      pythonOptions: ["-u"],
    });

    pyshell.send(
      JSON.stringify({
        action: "analyze_single",
        comment: text,
        lexicon: lexicon,
      }),
    );

    let result = "";
    pyshell.on("message", (message) => {
      result += message;
    });

    pyshell.on("stderr", (stderr) => {
      // Ignore debug output
    });

    pyshell.end((err) => {
      if (err) {
        reject(err);
      } else {
        try {
          const parsed = JSON.parse(result);
          if (parsed.success) {
            resolve({
              sentiment: parsed.sentiment || "neutral",
              confidence: parsed.confidence || 0.5,
              method: parsed.method || "python",
            });
          } else {
            reject(new Error(parsed.error || "Python analysis failed"));
          }
        } catch (parseErr) {
          reject(parseErr);
        }
      }
    });
  });
}

/**
 * JavaScript fallback sentiment analysis for a single comment
 */
function analyzeWithJavaScript(text) {
  const textLower = text.toLowerCase();

  // Negation patterns
  const negationPatterns = [
    "hindi naging maayos",
    "hindi maayos",
    "hindi maganda",
    "hindi malinaw",
    "hindi organized",
    "hindi okay",
    "hindi ayos",
    "di maayos",
    "di maganda",
    "not good",
    "not great",
    "not well",
    "not organized",
    "wasn't good",
    "wasn't great",
    "did not",
    "didn't",
    "couldn't",
  ];

  // Neutral indicators
  const neutralIndicators = [
    "average",
    "okay lang",
    "pwede na",
    "katamtaman",
    "sige lang",
    "could be improved",
    "could be better",
    "room for improvement",
    "some parts were",
    "while others",
    "pero may",
    "ngunit may",
    "pwede pang",
    "may improvement",
    "need improvement",
    "not bad",
    "so-so",
    "fair",
    "decent",
    "acceptable",
  ];

  const positiveKeywords = [
    "well-organized",
    "well organized",
    "enjoyable",
    "valuable",
    "knowledgeable",
    "engaging",
    "interested",
    "interesting",
    "good",
    "great",
    "excellent",
    "amazing",
    "wonderful",
    "fantastic",
    "love",
    "best",
    "awesome",
    "perfect",
    "satisfied",
    "happy",
    "pleased",
    "informative",
    "helpful",
    "enjoyed",
    "recommend",
    "thank",
    "thanks",
    "successful",
    "smooth",
    "professional",
    "maganda",
    "mabuti",
    "mahusay",
    "galing",
    "napakaganda",
    "napakagaling",
    "sobrang ganda",
    "sobrang galing",
    "masaya",
    "natutunan",
    "salamat",
    "sulit",
    "organisado",
    "maayos",
    "malinaw",
    "kapaki-pakinabang",
    "naging masaya",
  ];

  const negativeKeywords = [
    "lacked",
    "lacking",
    "late",
    "unclear",
    "difficult",
    "hard",
    "confusing",
    "confused",
    "poorly",
    "poor",
    "bad",
    "terrible",
    "awful",
    "horrible",
    "hate",
    "dislike",
    "worst",
    "disappointed",
    "disappointing",
    "unsatisfied",
    "frustrated",
    "boring",
    "waste",
    "disorganized",
    "unprepared",
    "crowded",
    "chaotic",
    "messy",
    "problem",
    "issue",
    "concern",
    "failed",
    "failure",
    "hindi naging maayos",
    "kakulangan",
    "nahirapan",
    "magulo",
    "hindi malinaw",
    "masama",
    "pangit",
    "nakakadismaya",
    "dismayado",
    "nakakainis",
    "nakakaasar",
    "badtrip",
    "sayang",
    "walang kwenta",
    "hindi maganda",
    "hindi okay",
    "kulang",
    "mali",
  ];

  const hasNegationPattern = negationPatterns.some((p) =>
    textLower.includes(p),
  );
  const hasNeutralIndicator = neutralIndicators.some((n) =>
    textLower.includes(n),
  );
  const positiveMatches = positiveKeywords.filter((k) =>
    textLower.includes(k),
  ).length;
  const negativeMatches = negativeKeywords.filter((k) =>
    textLower.includes(k),
  ).length;

  let sentiment = "neutral";
  let confidence = 0.5;

  if (hasNegationPattern) {
    sentiment = "negative";
    confidence = 0.8;
  } else if (
    hasNeutralIndicator &&
    positiveMatches > 0 &&
    positiveMatches <= 2
  ) {
    sentiment = "neutral";
    confidence = 0.7;
  } else if (negativeMatches > positiveMatches && negativeMatches > 0) {
    sentiment = "negative";
    confidence = Math.min(0.5 + negativeMatches * 0.1, 0.9);
  } else if (
    positiveMatches > negativeMatches &&
    positiveMatches > 0 &&
    !hasNeutralIndicator
  ) {
    sentiment = "positive";
    confidence = Math.min(0.5 + positiveMatches * 0.1, 0.9);
  } else if (hasNeutralIndicator) {
    sentiment = "neutral";
    confidence = 0.7;
  } else if (positiveMatches > 0 && negativeMatches === 0) {
    sentiment = "positive";
    confidence = Math.min(0.5 + positiveMatches * 0.1, 0.9);
  }

  return { sentiment, confidence, method: "javascript_fallback" };
}
