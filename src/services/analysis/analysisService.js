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
    // Enhanced fallback logging - make it very visible
    console.warn("⚠️ ============================================== ⚠️");
    console.warn("⚠️  PYTHON SENTIMENT ANALYSIS FAILED - USING FALLBACK");
    console.warn("⚠️ ============================================== ⚠️");
    console.error(
      "Error calling Python script for qualitative analysis:",
      error
    );
    console.error("Error details:", error.message);
    console.warn("Fallback reason:", error.message || "Unknown error");
    console.warn("Timestamp:", new Date().toISOString());
    console.warn("Comments to analyze:", comments.length);
    console.log("🔄 Falling back to enhanced JavaScript sentiment analysis...");

    // Pass the fallback reason to include in the response
    return await enhancedQualitativeAnalysis(
      comments,
      error.message || "Python script execution failed"
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
 * @param {string[]} comments - Array of comments to analyze
 * @param {string} fallbackReason - Optional reason why Python fallback was triggered
 */
async function enhancedQualitativeAnalysis(comments, fallbackReason = null) {
  console.warn("⚠️ Using JavaScript fallback for sentiment analysis");
  console.log(
    "🔄 Using enhanced JavaScript sentiment analysis with multilingual support"
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
  // This covers common event feedback vocabulary in both English and Tagalog
  const multilingualKeywords = {
    positive: {
      english: [
        // General positive
        "good",
        "great",
        "excellent",
        "amazing",
        "wonderful",
        "fantastic",
        "awesome",
        "perfect",
        "outstanding",
        "brilliant",
        "superb",
        "marvelous",
        "magnificent",
        "incredible",
        "fabulous",
        "splendid",
        "terrific",
        "phenomenal",
        "exceptional",
        "remarkable",
        "impressive",
        "stellar",
        "top-notch",
        "first-rate",
        "world-class",
        // Emotions
        "love",
        "loved",
        "like",
        "liked",
        "enjoy",
        "enjoyed",
        "happy",
        "pleased",
        "satisfied",
        "delighted",
        "thrilled",
        "excited",
        "grateful",
        "thankful",
        "appreciate",
        "appreciated",
        "glad",
        "joyful",
        "enthusiastic",
        // Event-specific positive
        "informative",
        "helpful",
        "useful",
        "valuable",
        "insightful",
        "enlightening",
        "educational",
        "inspiring",
        "motivating",
        "engaging",
        "interesting",
        "fun",
        "entertaining",
        "well-organized",
        "well-prepared",
        "well-managed",
        "smooth",
        "professional",
        "efficient",
        "effective",
        "productive",
        "beneficial",
        "rewarding",
        "worthwhile",
        "memorable",
        "unforgettable",
        // Quality descriptors
        "nice",
        "fine",
        "lovely",
        "beautiful",
        "elegant",
        "polished",
        "clean",
        "clear",
        "organized",
        "structured",
        "thorough",
        "comprehensive",
        "detailed",
        // Recommendations
        "recommend",
        "recommended",
        "worth it",
        "must attend",
        "highly recommend",
        // Intensified positive
        "very good",
        "so good",
        "really good",
        "absolutely amazing",
        "truly excellent",
      ],
      tagalog: [
        // General positive
        "maganda",
        "mabuti",
        "mahusay",
        "galing",
        "astig",
        "ayos",
        "swabe",
        "lupet",
        "mabait",
        "maayos",
        "malinaw",
        "malinis",
        "magaling",
        "kahanga-hanga",
        // Intensified
        "napakaganda",
        "napakahusay",
        "napakagaling",
        "napakaayos",
        "sobrang ganda",
        "sobrang galing",
        "sobrang husay",
        "ang ganda",
        "ang galing",
        "ang husay",
        "grabe ang ganda",
        "grabe ang galing",
        "hindi ko inexpect na ganito kaganda",
        // Emotions
        "masaya",
        "masayang-masaya",
        "natutuwa",
        "nakakatuwa",
        "nakaka-aliw",
        "satisfied",
        "contento",
        "may kasiyahan",
        "may galak",
        "nakakaproud",
        "nakakatuwa talaga",
        "tuwa na tuwa",
        "napakasaya",
        "lubos na kasiyahan",
        // Event-specific
        "nakakaengganyo",
        "nakaka-inspire",
        "nakakapag-isip",
        "informative",
        "maraming natutunan",
        "madaming natutunan",
        "may natutunan",
        "natuto ako",
        "nagustuhan ko",
        "bet ko",
        "love it",
        "go go go",
        "sulit",
        "worth it",
        "hindi sayang",
        "sulit sa oras",
        "sulit sa panahon",
        // Appreciation
        "salamat",
        "maraming salamat",
        "thank you",
        "appreciate",
        "nagpapasalamat",
        // Recommendations
        "irecommend ko",
        "irerecommend ko",
        "punta kayo",
        "attend kayo",
      ],
    },
    negative: {
      english: [
        // Strong negative
        "bad",
        "terrible",
        "awful",
        "horrible",
        "hate",
        "hated",
        "dislike",
        "worst",
        "disaster",
        "pathetic",
        "lousy",
        "dreadful",
        "abysmal",
        "atrocious",
        "appalling",
        "deplorable",
        "shocking",
        "unacceptable",
        "unbearable",
        "intolerable",
        "miserable",
        "disgusting",
        "repulsive",
        "offensive",
        // Emotions
        "disappointed",
        "disappointing",
        "unsatisfied",
        "sad",
        "angry",
        "frustrated",
        "annoyed",
        "irritated",
        "upset",
        "unhappy",
        "dissatisfied",
        "regret",
        "waste",
        "wasted",
        "bored",
        "boring",
        "tired",
        "exhausted",
        "stressed",
        // Event-specific negative
        "disorganized",
        "unprepared",
        "unprofessional",
        "chaotic",
        "messy",
        "confusing",
        "unclear",
        "vague",
        "rushed",
        "too fast",
        "too slow",
        "too long",
        "too short",
        "delayed",
        "late",
        "behind schedule",
        "overcrowded",
        "cramped",
        "noisy",
        "distracting",
        "uncomfortable",
        // Quality issues
        "poor",
        "weak",
        "lacking",
        "inadequate",
        "insufficient",
        "incomplete",
        "shallow",
        "superficial",
        "generic",
        "repetitive",
        "redundant",
        "outdated",
        "irrelevant",
        "useless",
        "pointless",
        "meaningless",
        // Mild criticism / constructive
        "mediocre",
        "average",
        "okay",
        "meh",
        "underwhelming",
        "unimpressive",
        "forgettable",
        "nothing special",
        "fair",
        "passable",
        "tolerable",
        "could be better",
        "needs improvement",
        "room for improvement",
        "not well",
        "not good",
        "not great",
        "not enough",
        "not clear",
        // Issues
        "issue",
        "issues",
        "problem",
        "problems",
        "concern",
        "concerns",
        "difficulty",
        "difficulties",
        "challenge",
        "challenges",
        "obstacle",
        "flaw",
        "flaws",
        "mistake",
        "mistakes",
        "error",
        "errors",
        // Negation patterns
        "didn't like",
        "don't like",
        "wasn't good",
        "weren't good",
        "couldn't understand",
        "didn't enjoy",
        "not satisfied",
        "not happy",
      ],
      tagalog: [
        // Strong negative
        "masama",
        "pangit",
        "nakakainis",
        "nakakaasar",
        "nakakagalit",
        "nakakabadtrip",
        "badtrip",
        "nakakasuka",
        "nakakadiri",
        "nakakahiya",
        "nakakadismaya",
        "napakapangit",
        "sobrang pangit",
        "napakamasama",
        "sobrang masama",
        // Intensified negative
        "ayaw",
        "ayaw ko",
        "ayaw na ayaw",
        "galit",
        "galit na galit",
        "inis na inis",
        "napakagalit",
        "sobrang galit",
        "grabe ang pangit",
        "walang kwenta",
        // Emotions
        "nalungkot",
        "nainis",
        "nagalit",
        "nadisappoint",
        "nadismaya",
        "nafrustrate",
        "na-stress",
        "napagod",
        "naumay",
        "nagsawa",
        "nabore",
        "walang gana",
        // Event-specific
        "magulo",
        "hindi maayos",
        "hindi malinaw",
        "mabagal",
        "matagal",
        "maikli",
        "masikip",
        "mainit",
        "maingay",
        "walang organisasyon",
        "late",
        "delayed",
        "hindi prepared",
        "kulang",
        "kulang-kulang",
        // Quality issues
        "hindi maganda",
        "hindi okay",
        "hindi ayos",
        "hindi sapat",
        "hindi kumpleto",
        "boring",
        "nakakabore",
        "nakakaumay",
        "nakakasawa",
        "paulit-ulit",
        // Mild criticism
        "pwede pa",
        "pwede pang i-improve",
        "may kulang",
        "may pagkukulang",
        "okay lang",
        "so-so",
        "meh",
        "hindi masama pero hindi rin maganda",
        // Issues
        "problema",
        "issue",
        "concern",
        "hirap",
        "mahirap",
        "nakakalito",
      ],
    },
    neutral: {
      english: [
        // Neutral descriptors
        "okay",
        "ok",
        "fine",
        "alright",
        "normal",
        "standard",
        "typical",
        "regular",
        "ordinary",
        "common",
        "usual",
        "expected",
        "predictable",
        // Suggestions without negative tone
        "suggest",
        "suggestion",
        "hope",
        "hoping",
        "maybe",
        "perhaps",
        "consider",
        "considering",
        "would be nice",
        "it would help",
        // Observations
        "noticed",
        "observed",
        "saw",
        "attended",
        "participated",
        "joined",
        "learned",
        "understood",
        "heard",
        "experienced",
      ],
      tagalog: [
        // Neutral descriptors
        "okay lang",
        "ayos lang",
        "pwede na",
        "okey",
        "normal",
        "katamtaman",
        "sakto lang",
        "pasado",
        "puwede",
        // Suggestions
        "sana",
        "siguro",
        "baka pwede",
        "kung pwede",
        // Observations
        "napansin ko",
        "nakita ko",
        "natutunan ko",
        "naintindihan ko",
        "dumalo ako",
        "sumali ako",
      ],
    },
    // Contrast indicators - signal mixed sentiment
    contrastIndicators: {
      english: [
        "but",
        "however",
        "although",
        "though",
        "yet",
        "still",
        "nevertheless",
        "nonetheless",
        "despite",
        "in spite of",
        "even though",
        "while",
        "whereas",
        "on the other hand",
        "unfortunately",
        "sadly",
        "except",
        "other than",
        "apart from",
        "aside from",
        "only issue",
        "only problem",
        "my only concern",
        "the only thing",
        "one thing",
      ],
      tagalog: [
        "pero",
        "ngunit",
        "subalit",
        "kahit",
        "kahit na",
        "bagamat",
        "gayunpaman",
        "sa kabila ng",
        "maliban sa",
        "kaya lang",
        "ang problema lang",
        "ang issue lang",
        "yung lang",
        "isa lang",
        "sayang",
        "sayang lang",
        "kaso",
        "kaso lang",
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
        "particularly",
        "especially",
        "definitely",
        "certainly",
        "surely",
        "quite",
        "rather",
        "fairly",
        "pretty",
        "somewhat",
      ],
      tagalog: [
        "napaka",
        "sobra",
        "sobrang",
        "labis",
        "lubos",
        "grabe",
        "talagang",
        "totoo",
        "tunay",
        "sadyang",
        "lubha",
        "labis na",
        "lubos na",
        "napaka-",
        "super",
        "ang",
        "ang-",
        "todo",
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

    // Analyze sentiment based on language - use ALL language keywords for mixed language
    let positiveScore = 0;
    let negativeScore = 0;
    let neutralScore = 0;
    let intensifierMultiplier = 1;
    let hasContrastIndicator = false;

    // Check for intensifiers first (both languages)
    const allIntensifiers = [
      ...multilingualKeywords.intensifiers.english,
      ...multilingualKeywords.intensifiers.tagalog,
    ];
    const intensifierCount = allIntensifiers.filter((intensifier) =>
      text.includes(intensifier)
    ).length;
    if (intensifierCount > 0) {
      intensifierMultiplier = 1 + intensifierCount * 0.3; // Increase weight for intensifiers
    }

    // Check for contrast indicators (both languages) - signals mixed sentiment
    const allContrastIndicators = [
      ...multilingualKeywords.contrastIndicators.english,
      ...multilingualKeywords.contrastIndicators.tagalog,
    ];
    hasContrastIndicator = allContrastIndicators.some((indicator) =>
      text.includes(indicator)
    );

    // Count positive keywords (both languages for mixed)
    const allPositiveKeywords = [
      ...multilingualKeywords.positive.english,
      ...multilingualKeywords.positive.tagalog,
    ];
    positiveScore =
      allPositiveKeywords.filter((keyword) => text.includes(keyword)).length *
      intensifierMultiplier;

    // Count negative keywords (both languages for mixed)
    const allNegativeKeywords = [
      ...multilingualKeywords.negative.english,
      ...multilingualKeywords.negative.tagalog,
    ];
    negativeScore =
      allNegativeKeywords.filter((keyword) => text.includes(keyword)).length *
      intensifierMultiplier;

    // Count neutral keywords (both languages)
    const allNeutralKeywords = [
      ...multilingualKeywords.neutral.english,
      ...multilingualKeywords.neutral.tagalog,
    ];
    neutralScore = allNeutralKeywords.filter((keyword) =>
      text.includes(keyword)
    ).length;

    // Determine sentiment with improved mixed detection
    let sentiment = "neutral";
    let confidence = 0.5;

    // Check if this is truly mixed sentiment:
    // 1. Has both positive AND negative keywords, OR
    // 2. Has contrast indicator with any sentiment keywords
    const hasBothSentiments = positiveScore > 0 && negativeScore > 0;
    const hasContrastWithSentiment =
      hasContrastIndicator && (positiveScore > 0 || negativeScore > 0);

    if (hasBothSentiments || hasContrastWithSentiment) {
      // Mixed sentiment - classify as neutral
      sentiment = "neutral";
      // Higher confidence if both scores are significant
      confidence = Math.min(0.6 + (positiveScore + negativeScore) * 0.03, 0.85);
    } else if (positiveScore > negativeScore && positiveScore > 0) {
      sentiment = "positive";
      confidence = Math.min(0.5 + positiveScore * 0.08, 0.95);
    } else if (negativeScore > positiveScore && negativeScore > 0) {
      sentiment = "negative";
      confidence = Math.min(0.5 + negativeScore * 0.08, 0.95);
    } else if (neutralScore > 0) {
      // Only neutral keywords found
      sentiment = "neutral";
      confidence = Math.min(0.5 + neutralScore * 0.1, 0.7);
    } else {
      // No keywords found - default to neutral with low confidence
      sentiment = "neutral";
      confidence = 0.3;
    }

    // Adjust confidence for mixed language
    if (language === "mixed") {
      confidence *= 0.9; // Slight reduction for mixed language
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
    // Fallback metadata - useful for monitoring and debugging
    fallback_used: true,
    fallback_reason: fallbackReason,
    fallback_timestamp: new Date().toISOString(),
    fallback_warning:
      "⚠️ Python sentiment analysis was unavailable. JavaScript fallback was used. Check server logs for details.",
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
  analyzeCommentSentiment,
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
            textContents.push(trimmed);
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

          // Check for negation patterns
          const hasNegationPattern = negationPatterns.some((pattern) =>
            textContent.includes(pattern)
          );

          // Check for neutral/mixed indicators
          const hasNeutralIndicator = neutralIndicators.some((indicator) =>
            textContent.includes(indicator)
          );

          const positiveMatches = positiveKeywords.filter((keyword) =>
            textContent.includes(keyword)
          ).length;
          const negativeMatches = negativeKeywords.filter((keyword) =>
            textContent.includes(keyword)
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
    "python.exe"
  );
  const venvPathUnix = path.resolve(
    __dirname,
    "../../../venv",
    "bin",
    "python"
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

  try {
    // Try Python analysis first (most accurate)
    result = await analyzeSingleWithPython(cleanText);
  } catch (error) {
    console.log(
      `[SENTIMENT] Python failed for "${cleanText.substring(0, 30)}...": ${
        error.message
      }`
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
 */
async function analyzeSingleWithPython(text) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(__dirname, "../../../text_analysis.py");
    const pythonPath = getPythonPath();

    const pyshell = new PythonShell(scriptPath, {
      pythonPath,
      pythonOptions: ["-u"],
    });

    pyshell.send(JSON.stringify({ action: "analyze_single", comment: text }));

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
    textLower.includes(p)
  );
  const hasNeutralIndicator = neutralIndicators.some((n) =>
    textLower.includes(n)
  );
  const positiveMatches = positiveKeywords.filter((k) =>
    textLower.includes(k)
  ).length;
  const negativeMatches = negativeKeywords.filter((k) =>
    textLower.includes(k)
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
