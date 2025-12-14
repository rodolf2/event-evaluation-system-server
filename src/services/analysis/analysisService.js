const Feedback = require("../../models/Feedback");
const Event = require("../../models/Event");
const Form = require("../../models/Form");
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
        "python.exe"
      );
      const venvPathUnix = path.resolve(
        __dirname,
        "../../../venv",
        "bin",
        "python"
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
        })
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
      error
    );
    console.error("Error details:", error.message);

    // Fallback to enhanced JavaScript-based analysis if Python fails
    console.log("🔄 Falling back to enhanced JavaScript sentiment analysis...");
    return await enhancedQualitativeAnalysis(comments);
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
        "python.exe"
      );
      const venvPathUnix = path.resolve(
        __dirname,
        "../../../venv",
        "bin",
        "python"
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
        })
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
      `Excellent feedback received with ${positivePercent}% positive sentiment, indicating high satisfaction with the event.`
    );
  } else if (positivePercent > 40) {
    insights.push(
      `Generally positive feedback with ${positivePercent}% positive sentiment, showing good overall satisfaction.`
    );
  } else if (negativePercent > 30) {
    insights.push(
      `Areas of concern identified with ${negativePercent}% negative sentiment that require attention.`
    );
  }

  // Language insights
  const englishCount = analyzed_feedbacks.filter(
    (f) => f.analysis.language?.language === "en"
  ).length;
  const tagalogCount = analyzed_feedbacks.filter(
    (f) => f.analysis.language?.language === "tl"
  ).length;

  if (englishCount > 0 && tagalogCount > 0) {
    insights.push(
      `Multilingual feedback received: ${englishCount} English and ${tagalogCount} Tagalog comments analyzed.`
    );
  }

  // Confidence insights
  const highConfidence = analyzed_feedbacks.filter(
    (f) => f.analysis.confidence > 0.7
  ).length;
  const confidenceRate = ((highConfidence / total) * 100).toFixed(1);

  insights.push(
    `Analysis confidence: ${confidenceRate}% of feedback was analyzed with high confidence using advanced multilingual sentiment analysis.`
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
      "Address negative feedback promptly to improve future events."
    );
    recommendations.push(
      "Consider follow-up surveys to understand specific concerns mentioned."
    );
  }

  if (positivePercent > 70) {
    recommendations.push(
      "Continue successful practices that contributed to high satisfaction."
    );
    recommendations.push(
      "Use positive feedback examples in future event planning."
    );
  }

  if (analyzed_feedbacks.some((f) => f.analysis.language?.language === "tl")) {
    recommendations.push(
      "Ensure multilingual support in future communications and surveys."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("Maintain current event quality standards.");
    recommendations.push(
      "Continue gathering detailed feedback for continuous improvement."
    );
  }

  return recommendations.join(" ");
}

/**
 * Enhanced JavaScript qualitative analysis with multilingual support
 */
async function enhancedQualitativeAnalysis(comments) {
  console.log(
    "🔄 Using enhanced JavaScript sentiment analysis with multilingual support"
  );

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

  // Enhanced multilingual keyword analysis
  const multilingualKeywords = {
    positive: {
      english: [
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
        "outstanding",
        "brilliant",
        "superb",
        "marvelous",
        "delightful",
        "enjoyable",
        "thrilling",
        "incredible",
        "fabulous",
        "splendid",
        "magnificent",
        "super",
        "terrific",
        "phenomenal",
        "exceptional",
        "remarkable",
      ],
      tagalog: [
        "maganda",
        "mabuti",
        "masaya",
        "nakakatuwa",
        "galing",
        "bilib",
        "ang ganda",
        "napakaganda",
        "sobrang ganda",
        "napakagaling",
        "sobrang galing",
        "nakakaaliw",
        "nakakatuwa",
        "nakakatuwa talaga",
        "napakasaya",
        "masayang-masaya",
        "tuwa na tuwa",
        "labis na kasiyahan",
        "lubos na kasiyahan",
        "masarap",
        "napakasarap",
        "napakahusay",
        "husay na husay",
      ],
    },
    negative: {
      english: [
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
        "disaster",
        "pathetic",
        "lousy",
        "dreadful",
        "abysmal",
        "atrocious",
        "appalling",
        "dismal",
        "deplorable",
        "shocking",
        "unacceptable",
        "unbearable",
        "intolerable",
        "excruciating",
        "agonizing",
        "miserable",
      ],
      tagalog: [
        "masama",
        "pangit",
        "nakakaasar",
        "nakakainis",
        "galit",
        "ayaw",
        "badtrip",
        "nakakagalit",
        "nakakasuka",
        "nakakadiri",
        "nakakainis talaga",
        "nakakafrustrate",
        "nakakabadtrip",
        "nakakagalit na",
        "napakapangit",
        "sobrang pangit",
        "napakamasama",
        "sobrang masama",
        "napakagalit",
        "ayaw na ayaw",
        "galit na galit",
        "inis na inis",
        "badtrip na badtrip",
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
        "completely",
        "utterly",
        "highly",
        "incredibly",
        "tremendously",
        "enormously",
        "immensely",
        "vastly",
        "hugely",
        "massively",
        "colossally",
        "monumentally",
      ],
      tagalog: [
        "napaka",
        "sobra",
        "labis",
        "lubos",
        "napaka-",
        "sobrang",
        "labis na",
        "lubos na",
        "talagang",
        "totoo",
        "tunay",
        "dati",
        "sadya",
      ],
    },
  };

  // Language detection patterns
  const languagePatterns = {
    tagalog:
      /\b(ang|ng|sa|kay|ko|mo|nya|kami|kayo|sila|ito|iyan|iyon|dito|doon|kanino|alin|paano|kailan|bakit|talaga|nga|naman|rin|din|pa|po|ho|ka|ta|ta ka|ka ba|ba|ako|ikaw|siya|kami|kayo|sila)\b/i,
    english:
      /\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|can|could|should|may|might|must|shall)\b/i,
  };

  comments.forEach((comment) => {
    if (!comment || !comment.trim()) return;

    const text = comment.toLowerCase();
    let language = "mixed";

    // Simple language detection
    const hasTagalog = languagePatterns.tagalog.test(text);
    const hasEnglish = languagePatterns.english.test(text);

    if (hasTagalog && !hasEnglish) language = "tagalog";
    else if (hasEnglish && !hasTagalog) language = "english";
    else language = "mixed";

    // Analyze sentiment based on language
    let positiveScore = 0;
    let negativeScore = 0;
    let intensifierMultiplier = 1;

    // Check for intensifiers first
    const allIntensifiers = [
      ...multilingualKeywords.intensifiers.english,
      ...multilingualKeywords.intensifiers.tagalog,
    ];
    const intensifierCount = allIntensifiers.filter((intensifier) =>
      text.includes(intensifier)
    ).length;
    if (intensifierCount > 0) {
      intensifierMultiplier = 1 + intensifierCount * 0.5; // Increase weight for intensifiers
    }

    // Count positive keywords
    const positiveKeywords =
      language === "tagalog"
        ? multilingualKeywords.positive.tagalog
        : multilingualKeywords.positive.english;
    positiveScore =
      positiveKeywords.filter((keyword) => text.includes(keyword)).length *
      intensifierMultiplier;

    // Count negative keywords
    const negativeKeywords =
      language === "tagalog"
        ? multilingualKeywords.negative.tagalog
        : multilingualKeywords.negative.english;
    negativeScore =
      negativeKeywords.filter((keyword) => text.includes(keyword)).length *
      intensifierMultiplier;

    // Determine sentiment with confidence
    // If both positive and negative scores are equal (including both > 0), treat as neutral (mixed sentiment)
    let sentiment = "neutral";
    let confidence = 0.5;

    if (positiveScore === negativeScore) {
      // Equal scores = neutral/mixed sentiment (don't split the comment)
      sentiment = "neutral";
      confidence = positiveScore > 0 ? 0.6 : 0.5; // Slightly higher confidence if there are actual keywords
    } else if (positiveScore > negativeScore && positiveScore > 0) {
      sentiment = "positive";
      confidence = Math.min(0.5 + positiveScore * 0.1, 0.9);
    } else if (negativeScore > positiveScore && negativeScore > 0) {
      sentiment = "negative";
      confidence = Math.min(0.5 + negativeScore * 0.1, 0.9);
    }

    // Special handling for mixed language
    if (language === "mixed") {
      confidence *= 0.8; // Reduce confidence for mixed language
    }

    categorized_comments[sentiment].push({
      text: comment,
      analysis: {
        sentiment: sentiment,
        confidence: confidence,
        language: language,
        method: "enhanced_javascript_multilingual",
        scores: { positive: positiveScore, negative: negativeScore },
      },
    });

    sentiment_counts[sentiment]++;
  });

  const total = comments.length;
  const summary = {};

  for (const sentiment of ["positive", "negative", "neutral"]) {
    const count = sentiment_counts[sentiment];
    const percentage =
      total > 0 ? Math.round((count / total) * 100 * 100) / 100 : 0;
    summary[sentiment] = {
      count: count,
      percentage: percentage,
    };
  }

  // Generate enhanced insights
  const insights = generateEnhancedInsights(summary, comments);

  return {
    summary: summary,
    insights: insights,
    recommendations: generateEnhancedRecommendations(summary),
    comments: categorized_comments,
    analysis_method: "enhanced_javascript_multilingual",
    language_support: "English and Tagalog with mixed language detection",
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
      `Excellent multilingual feedback received with ${positivePercent}% positive sentiment, indicating high satisfaction across English and Tagalog responses.`
    );
  } else if (positivePercent > 40) {
    insights.push(
      `Generally positive multilingual feedback with ${positivePercent}% positive sentiment, showing good overall satisfaction.`
    );
  } else if (negativePercent > 30) {
    insights.push(
      `Areas of concern identified with ${negativePercent}% negative sentiment that require attention in both languages.`
    );
  }

  // Language diversity insights
  const englishComments = comments.filter(
    (c) =>
      c &&
      c
        .toLowerCase()
        .match(/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by)\b/i)
  ).length;
  const tagalogComments = comments.filter(
    (c) => c && c.toLowerCase().match(/\b(ang|ng|sa|kay|ko|mo|nya)\b/i)
  ).length;

  if (englishComments > 0 && tagalogComments > 0) {
    const englishPercent = Math.round((englishComments / total) * 100);
    const tagalogPercent = Math.round((tagalogComments / total) * 100);
    insights.push(
      `Multilingual feedback received: approximately ${englishPercent}% English and ${tagalogPercent}% Tagalog responses analyzed.`
    );
  }

  insights.push(
    `Enhanced sentiment analysis completed with multilingual keyword detection and confidence scoring.`
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
      "Address negative feedback promptly to improve future events."
    );
    recommendations.push(
      "Consider follow-up surveys in both English and Tagalog to understand specific concerns."
    );
  }

  if (positivePercent > 70) {
    recommendations.push(
      "Continue successful practices that contributed to high satisfaction."
    );
    recommendations.push(
      "Use positive feedback examples in future multilingual communications."
    );
  }

  recommendations.push(
    "Maintain multilingual support in surveys and communications."
  );
  recommendations.push(
    "Continue gathering detailed feedback for continuous improvement."
  );

  return recommendations.join(" ");
}

module.exports = {
  getAverageRating,
  generateQualitativeReport,
  generateQuantitativeReport,
  analyzeResponses,
  generateResponseOverview,
};

/**
 * Analyzes form responses for sentiment and breakdown using Python
 * @param {boolean} usePython - Whether to use Python for analysis (default: true)
 * @returns {Object} Analysis results with sentiment breakdown
 */
async function analyzeResponses(responses, usePython = true) {
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
    // Extract text content from responses
    const textContents = [];

    responses.forEach((response) => {
      if (response.responses && Array.isArray(response.responses)) {
        let textContent = "";

        // Extract text from all responses
        response.responses.forEach((q) => {
          if (typeof q.answer === "string") {
            textContent += " " + q.answer;
          } else if (Array.isArray(q.answer)) {
            textContent += " " + q.answer.join(" ");
          }
        });

        if (textContent.trim()) {
          textContents.push(textContent.trim());
        }
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
        "python.exe"
      );
      const venvPathUnix = path.resolve(
        __dirname,
        "../../../venv",
        "bin",
        "python"
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
        })
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
    return fallbackAnalyzeResponses(responses);
  }
}

/**
 * Fallback JavaScript analysis for form responses
 */
function fallbackAnalyzeResponses(responses) {
  console.log("Using JavaScript fallback for response analysis");

  let positiveCount = 0;
  let neutralCount = 0;
  let negativeCount = 0;

  // Simple keyword-based sentiment analysis
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

  responses.forEach((response) => {
    if (response.responses && Array.isArray(response.responses)) {
      let textContent = "";

      // Extract text from all responses
      response.responses.forEach((q) => {
        if (typeof q.answer === "string") {
          textContent += " " + q.answer.toLowerCase();
        } else if (Array.isArray(q.answer)) {
          textContent += " " + q.answer.join(" ").toLowerCase();
        }
      });

      if (textContent.trim()) {
        // Count keyword matches
        const positiveMatches = positiveKeywords.filter((keyword) =>
          textContent.includes(keyword)
        ).length;
        const negativeMatches = negativeKeywords.filter((keyword) =>
          textContent.includes(keyword)
        ).length;

        // Determine sentiment
        // Equal positive and negative = neutral (mixed sentiment, don't split)
        if (positiveMatches === negativeMatches) {
          // Equal scores = neutral/mixed sentiment
          neutralCount++;
        } else if (positiveMatches > negativeMatches && positiveMatches > 0) {
          positiveCount++;
        } else if (negativeMatches > positiveMatches && negativeMatches > 0) {
          negativeCount++;
        } else {
          neutralCount++;
        }
      } else {
        // If no text content, treat as neutral
        neutralCount++;
      }
    }
  });

  const total = responses.length;
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
