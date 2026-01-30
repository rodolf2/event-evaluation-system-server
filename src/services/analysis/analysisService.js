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
      const options = getPythonOptions(scriptPath);
      const scriptName = path.basename(scriptPath);

      console.log("Calling Python script for sentiment analysis:", scriptName);
      console.log("Script Directory:", options.scriptPath);
      console.log("Number of comments to analyze:", comments.length);
      
      const pyshell = new PythonShell(scriptName, options);

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
    console.error(
      "Error calling Python script for qualitative analysis:",
      error,
    );
    throw error;
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
      const options = getPythonOptions(scriptPath);
      const scriptName = path.basename(scriptPath);
      
      const pyshell = new PythonShell(scriptName, options);

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
    throw error; // Propagate error now that fallback is removed
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
 * Analyzes form responses for sentiment and breakdown using Python
 * @param {Array} responses - Form responses
 * @param {Object} questionTypeMap - Map of question IDs/titles to types
 * @returns {Object} Analysis results with sentiment breakdown
 */
async function analyzeResponses(responses, questionTypeMap = null) {
  if (!responses || responses.length === 0) {
    return {
      sentimentBreakdown: {
        positive: { count: 0, percentage: 0 },
        neutral: { count: 0, percentage: 0 },
        negative: { count: 0, percentage: 0 },
      },
    };
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
                questionTypeMap[q.questionId] ||
                questionTypeMap[q.questionTitle];
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
      const options = getPythonOptions(scriptPath);
      const scriptName = path.basename(scriptPath);

      const pyshell = new PythonShell(scriptName, options);

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
    throw error;
  }
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
/**
 * Get Python path/command for sentiment analysis
 * Prioritizes standard venv for local dev, falls back to system python + PYTHONPATH for Render
 */
function getPythonPath() {
  const fs = require("fs");
  const path = require("path");
  console.log("🔍 Detect Python Environment");
  
  // 1. Check for local venv (Standard for local development)
  const cwdVenvPathWin = path.join(process.cwd(), "venv", "Scripts", "python.exe");
  const cwdVenvPathUnix = path.join(process.cwd(), "venv", "bin", "python");

  if (process.platform === "win32" && fs.existsSync(cwdVenvPathWin)) {
    console.log("✅ CHECK: Found Local venv (Win) at:", cwdVenvPathWin);
    return cwdVenvPathWin;
  }
  if (process.platform !== "win32" && fs.existsSync(cwdVenvPathUnix)) {
    console.log("✅ CHECK: Found Local venv (Unix) at:", cwdVenvPathUnix);
    return cwdVenvPathUnix;
  }

  // 2. Check for Railway venv (Explicit path)
  const railwayVenvPath = "/app/venv/bin/python";
  if (fs.existsSync(railwayVenvPath)) {
    console.log("✅ CHECK: Found Railway venv at:", railwayVenvPath);
    return railwayVenvPath;
  }

  // 3. Check for Render venv (Explicit path)
  const renderVenvPath = "/opt/render/project/src/venv/bin/python";
  if (fs.existsSync(renderVenvPath)) {
    console.log("✅ CHECK: Found Render venv at:", renderVenvPath);
    return renderVenvPath;
  }

  // 4. Fallback to system python (relies on PYTHONPATH for libraries)
  console.log("⚠️ No virtual environment found. Using system python with PYTHONPATH.");
  if (process.platform === "win32") return "python";
  return "python3";
}

/**
 * Configure PythonShell options with custom PYTHONPATH
 */
function getPythonOptions(scriptPath) {
    const pythonPath = getPythonPath();
    const env = { ...process.env };
    
    // Only inject PYTHONPATH if we are NOT using a venv
    // (If using venv, libraries are already in path)
    const isVenv = pythonPath.includes("venv");
    
    if (!isVenv) {
        const pythonLibs = path.resolve(__dirname, "../../../python_libs");
        const renderLibs = "/opt/render/project/src/python_libs";
        
        let pythonPathEnv = process.env.PYTHONPATH || "";
        if (require("fs").existsSync(pythonLibs)) {
            pythonPathEnv = `${pythonLibs}${path.delimiter}${pythonPathEnv}`;
            console.log(`🔧 Injecting PYTHONPATH (Local libs): ${pythonLibs}`);
        } else if (require("fs").existsSync(renderLibs)) {
            pythonPathEnv = `${renderLibs}${path.delimiter}${pythonPathEnv}`;
             console.log(`🔧 Injecting PYTHONPATH (Render libs): ${renderLibs}`);
        }
        env.PYTHONPATH = pythonPathEnv;
    }

    // Ensure NLTK_DATA is set
    const nltkData = path.resolve(__dirname, "../../../nltk_data");
    env.NLTK_DATA = nltkData;


    const scriptDir = path.dirname(scriptPath);
    console.log(`🔧 Python Options - Script Dir: ${scriptDir}`);

    return {
        mode: 'text',
        pythonPath: pythonPath,
        pythonOptions: ['-u'],
        scriptPath: scriptDir, // Explicitly set directory
        env: env
    };
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

  // Fetch lexicon to pass to Python for custom word support
  const dbLexicon = await Lexicon.find().lean();

  // Python analysis (SINGLE SOURCE OF TRUTH)
  const result = await analyzeSingleWithPython(cleanText, dbLexicon);

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
    const options = getPythonOptions(scriptPath);
    const scriptName = path.basename(scriptPath);

    const pyshell = new PythonShell(scriptName, options);

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

module.exports = {
  getAverageRating,
  generateQualitativeReport,
  generateQuantitativeReport,
  analyzeResponses,
  generateResponseOverview,
  analyzeCommentSentiment,
};
