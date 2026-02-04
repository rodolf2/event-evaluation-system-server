const Feedback = require("../../models/Feedback");
const Event = require("../../models/Event");
const Form = require("../../models/Form");
const Lexicon = require("../../models/Lexicon");
const mongoose = require("mongoose");
const path = require("path");
const { PythonShell } = require("python-shell");
const Sentiment = require("sentiment");
const sentimentLib = new Sentiment();

// ============================================================================
// COMPREHENSIVE SENTIMENT ANALYSIS CONFIGURATION (Mirrors Python text_analysis.py)
// ============================================================================

// Tagalog positive words with weights
const tagalogPositive = {
  // Basic positive words and roots (weight: 1)
  maganda: 1,
  ganda: 1,
  mabuti: 1,
  buti: 1,
  masaya: 1,
  saya: 1,
  nakakatuwa: 1,
  tuwa: 1,
  galing: 1,
  magaling: 1,
  bilib: 1,
  husay: 1,
  mahusay: 1,
  astig: 1,
  sulit: 1,
  panalo: 1,
  maayos: 1,
  ayos: 1,
  linis: 1,
  malinis: 1,
  effective: 1,
  efficient: 1,
  successful: 1,
  tagumpay: 1,
  productive: 1,
  organized: 1,
  smooth: 1,
  professional: 1,
  natuto: 1,
  natutunan: 1,
  nakatulong: 1,
  helpful: 1,
  satisfied: 1,
  fun: 1,
  interesting: 1,
  educational: 1,
  useful: 1,
  motivating: 1,
  solid: 1,
  swabe: 1,
  oks: 0.5,
  goods: 1,
  nice: 1,
  yes: 1,
  oo: 1,
  sige: 0.5,
  salamat: 1,
  grateful: 1,
  appreciate: 1,
  appreciated: 1,
  thankful: 1,
  enjoy: 1,
  enjoyed: 1,
  amazing: 1.5,
  awesome: 1.5,
  excellent: 1.5,
  outstanding: 1.5,
  perfect: 1.5,
  fantastic: 1.5,
  wonderful: 1.5,
  great: 1,
  good: 1,
  best: 1.5,
  love: 1.5,
  loved: 1.5,
  like: 0.8,
  happy: 1,
  glad: 1,
  pleased: 1,
  delighted: 1.2,
  impressive: 1.2,
  recommend: 1,
  recommended: 1,
  forward: 0.5,
};

// Tagalog negative words with weights
const tagalogNegative = {
  // Basic negative words and roots (weight: -1)
  masama: -1,
  sama: -1,
  pangit: -1,
  panget: -1,
  nakakaasar: -1,
  asar: -1,
  nakakainis: -1,
  inis: -1,
  galit: -1,
  ayaw: -1,
  badtrip: -1,
  nakakagalit: -1,
  boring: -1,
  nakakaantok: -1,
  sayang: -1,
  disappointed: -1,
  disappointing: -1,
  nakakadismaya: -1,
  dismaya: -1,
  dismayado: -1,
  nabigo: -1,
  failed: -1,
  problem: -0.7,
  problema: -0.7,
  mali: -0.8,
  kulang: -0.7,
  kakulangan: -0.8,
  incomplete: -0.7,
  poor: -1,
  crowded: -0.8,
  difficult: -0.8,
  nahirapan: -0.8,
  hard: -0.7,
  frustrated: -1,
  frustrating: -1,
  nakakafrustrate: -1,
  bad: -1,
  worst: -2,
  disorganized: -1,
  chaotic: -1,
  pila: -0.5,
  hours: -0.6,
  oras: -0.6,
  dalawa: -0.3,
  // Physical discomfort/Environmental
  mainit: -1,
  init: -1,
  maingay: -1,
  ingay: -1,
  mausok: -1,
  usok: -1,
  siksikan: -1,
  madumi: -1,
  dumi: -1,
  mabaho: -1,
  baho: -1,
  sira: -1,
  broken: -1,
  gutom: -1,
  // Additional strong negative words
  hassle: -1,
  inconvenient: -1,
  uncomfortable: -0.8,
  unprofessional: -0.5,
  rude: -0.5,
  slow: -0.3,
  confusing: -0.4,
  angry: -0.8,
  mad: -0.7,
  furious: -0.9,
  annoyed: -0.6,
  starving: -2.0,
  hungry: -2.0,
  bagsak: -1.5,
  lungkot: -1,
  nakakalungkot: -1,
  terrible: -1.5,
  horrible: -1.5,
  awful: -1.5,
  hate: -1.5,
  hated: -1.5,
  dislike: -1,
  annoying: -1,
  annoyed: -1,
  waste: -1,
  wasted: -1,
  useless: -1.2,
  pointless: -1,
};

// Positive phrases (higher weight)
const positivePhrases = [
  "very good",
  "ang ganda",
  "sobrang ganda",
  "sobra ganda",
  "ang galing",
  "maraming salamat",
  "thank you so much",
  "napakaganda",
  "napakagaling",
  "the best",
  "well done",
  "job well done",
  "great job",
  "excellent work",
  "love it",
  "loved it",
  "napakasaya",
  "sobrang saya",
  "sobra saya",
  "ang saya",
  "napakaayos",
  "sobrang ayos",
  "ang husay",
  "napakatahimik",
  "well-organized",
  "well-prepared",
  "well-managed",
  "well-planned",
  "highly recommend",
  "best experience",
  "really enjoyed",
  "so happy",
  "panalo to",
  "solid to",
  "goods to",
  "swabe lang",
  "walang hassle",
  "okay na okay",
  "ayos na ayos",
  "sarap ng",
  "ang sarap",
  "looking forward",
  "next one",
  "next year",
  "next event",
];

// Negative phrases (higher weight)
const negativePhrases = [
  "not good",
  "not great",
  "hindi maganda",
  "walang kwenta",
  "waste of time",
  "sayang lang",
  "hindi ako satisfied",
  "bad experience",
  "poor quality",
  "very bad",
  "so bad",
  "napakamasama",
  "sobrang masama",
  "ang sama",
  "napakapangit",
  "sobrang pangit",
  "hindi prepared",
  "hindi naging maayos",
  "hindi maayos",
  "hindi okay",
  "hindi ayos",
  "di maayos",
  "di maganda",
  "waste of energy",
  "sayang oras",
  "sayang pera",
  "nakakadismaya",
  "nakaka-bored",
  "ang gulo",
  "sobrang gulo",
  "walang silbi",
  "basura",
  "worst experience",
  "not satisfied",
  "needs improvement",
  "could be better",
  "room for improvement",
  "medyo magulo",
  "medyo matagal",
  "medyo mainit",
];

// Neutral indicators
const neutralIndicators = [
  "okay",
  "ok",
  "alright",
  "fine",
  "so-so",
  "average",
  "normal",
  "ordinary",
  "fair",
  "decent",
  "not bad",
  "moderate",
  "acceptable",
  "passable",
  "adequate",
  "sufficient",
  "however",
  // Tagalog neutral - common expressions (prioritized patterns)
  "okay lang",
  "ok lang",
  "oks lang",
  "ayos lang",
  "pwede na",
  "pwede naman",
  "ganon lang",
  "ganun lang",
  "sige lang",
  "lang naman",
  "naman",
  "typical",
  "karaniwan",
  "normal lang",
  "pwede",
  "maaari",
  "maybe",
  "perhaps",
  "siguro",
  // Key neutral Tagalog expressions with "lang" (just/only) modifier
  "sakto lang",
  "sakto",
  "tama lang",
  "kaya lang",
  "medyo",
  "walang masyadong",
  "walang special",
  "walang espesyal",
  // Mixed/hesitant expressions
  "may improvement",
  "pwede pang",
  "pero okay",
  "pero ayos",
];

// Negation words
const negations = [
  "not",
  "no",
  "never",
  "don't",
  "doesn't",
  "didn't",
  "won't",
  "can't",
  "cannot",
  "hindi",
  "wala",
  "walang",
  "di",
  "hinde",
  "ayaw",
  "di ko",
  "hindi ko",
];

// Intensifiers and diminishers
const intensifiers = [
  "very",
  "really",
  "extremely",
  "super",
  "sobra",
  "sobrang",
  "napaka",
  "labis",
  "grabe",
  "talaga",
  "so",
  "too",
  "ganado",
  "masyado",
  "absolutely",
  "incredibly",
  "highly",
  "totally",
  "completely",
];

const diminishers = [
  "slightly",
  "somewhat",
  "a bit",
  "a little",
  "medyo",
  "konti",
  "kaunti",
  "bahagya",
  "kind of",
  "kinda",
  "sort of",
];

// Contrast words (indicates mixed sentiment)
const contrastWords = [
  "but",
  "however",
  "although",
  "pero",
  "ngunit",
  "subalit",
  "kaso",
  "though",
];

// Constructive criticism patterns
const constructivePatterns = [
  "could be improved",
  "could still be improved",
  "room for improvement",
  "with a few adjustments",
  "next time",
  "believe the next",
  "can be even better",
  "some areas",
  "however",
  "but",
  "although",
  "maaaring pagbutihin",
  "maaaring mapabuti",
  "may mga areas na maaaring",
  "sa susunod",
  "pwede pang mapabuti",
  "sana ay maayos",
  "pero",
  "ngunit",
  "subalit",
  "gayunpaman",
];

// Emoticons and emoji with scores
const emojiScores = {
  "😊": 0.5,
  "😀": 0.5,
  "😄": 0.5,
  "😍": 0.7,
  "👍": 0.5,
  "🙌": 0.5,
  "🎉": 0.7,
  "❤️": 0.7,
  "🔥": 0.5,
  "💯": 0.5,
  "⭐": 0.5,
  "🌟": 0.5,
  ":)": 0.3,
  ":D": 0.3,
  "😞": -0.5,
  "😢": -0.5,
  "😠": -0.7,
  "😡": -0.7,
  "👎": -0.5,
  "😕": -0.5,
  "😔": -0.5,
  "💔": -0.7,
  "🤢": -0.7,
  ":(": -0.3,
  "D:": -0.3,
};

// Tagalog affixes for stemming
const tagalogPrefixes = [
  "nag-",
  "nag",
  "mag-",
  "mag",
  "na-",
  "na",
  "ma-",
  "ma",
  "naka-",
  "naka",
  "ipinag-",
  "ipinag",
  "pag-",
  "pag",
  "nakaka-",
  "nakaka",
];
const tagalogSuffixes = [
  "-an",
  "an",
  "-in",
  "in",
  "-nan",
  "nan",
  "-hin",
  "hin",
];

/**
 * Simple rule-based stemming for Tagalog/Taglish
 */
function stemTagalog(word) {
  if (word.length <= 4) return word;

  let stemmed = word;

  // Handle prefixes (sorted by length, longest first)
  const sortedPrefixes = [...tagalogPrefixes].sort(
    (a, b) => b.length - a.length,
  );
  for (const prefix of sortedPrefixes) {
    if (stemmed.startsWith(prefix)) {
      stemmed = stemmed.slice(prefix.length);
      if (stemmed.startsWith("-")) stemmed = stemmed.slice(1);
      break;
    }
  }

  // Handle suffixes
  if (stemmed.length > 4) {
    const sortedSuffixes = [...tagalogSuffixes].sort(
      (a, b) => b.length - a.length,
    );
    for (const suffix of sortedSuffixes) {
      if (stemmed.endsWith(suffix)) {
        stemmed = stemmed.slice(0, -suffix.length);
        if (stemmed.endsWith("-")) stemmed = stemmed.slice(0, -1);
        break;
      }
    }
  }

  return stemmed.length >= 3 ? stemmed : word;
}

// Register Tagalog language with sentiment library
const tagalogLanguage = {
  labels: { ...tagalogPositive },
};
// Add negative words (sentiment library expects positive numbers, we'll handle negation ourselves)
Object.keys(tagalogNegative).forEach((word) => {
  tagalogLanguage.labels[word] = tagalogNegative[word];
});
sentimentLib.registerLanguage("tl", tagalogLanguage);

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

  // Quick check: is Python available?
  const { execSync } = require("child_process");
  let pythonAvailable = false;
  try {
    const pythonPath = getPythonPath();
    execSync(`${pythonPath} --version`, { stdio: "pipe" });
    pythonAvailable = true;
    console.log(`✅ Python is available at: ${pythonPath}`);
  } catch (err) {
    console.warn(
      `⚠️ Python is NOT available on this system. Will use JavaScript fallback.`,
    );
    pythonAvailable = false;
  }

  // If Python is not available, skip to fallback immediately
  if (!pythonAvailable) {
    console.log(
      "[SKIP PYTHON] Using JavaScript fallback for sentiment analysis",
    );
    throw new Error("Python not available - using fallback");
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

      // Set a SHORTER timeout for local (10s), longer for Render (30s)
      const isLocal =
        !process.env.RENDER && !process.cwd().includes("/opt/render");
      const timeoutMs = isLocal ? 10000 : 30000;

      console.log(
        `[PYTHON] Starting sentiment analysis (timeout: ${timeoutMs}ms, local: ${isLocal})`,
      );

      let hasStarted = false;
      const pythonTimeout = setTimeout(() => {
        console.warn(
          `[TIMEOUT] Python taking too long (>${timeoutMs}ms), terminating process...`,
        );
        pyshell.kill("SIGKILL");
        reject(new Error(`Python timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      // Send data to Python script
      console.log(`[PYTHON] Sending ${comments.length} comments to Python...`);
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
        hasStarted = true;
        console.log(`[PYTHON] Message received (${message.length} bytes)`);
        result += message;
      });

      pyshell.on("stderr", (stderr) => {
        console.log("[PYTHON] stderr:", stderr.substring(0, 100));
        errorOutput += stderr;
      });

      pyshell.end((err) => {
        clearTimeout(pythonTimeout);
        console.log(
          `[PYTHON] Process ended. Error: ${err ? err.message : "none"}, Started: ${hasStarted}`,
        );

        if (err) {
          console.error("Python script error:", err.message);
          reject(err);
        } else {
          try {
            if (!result || result.trim() === "") {
              throw new Error("Python returned empty result");
            }
            const parsedResult = JSON.parse(result);
            console.log("✅ Python analysis completed successfully");
            resolve(parsedResult);
          } catch (parseErr) {
            console.error(
              "❌ Failed to parse Python result:",
              parseErr.message,
            );
            console.error("Raw result length:", result.length);
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
      error.message,
    );
    console.warn(
      "[FALLBACK] Using JavaScript sentiment analysis instead of Python",
    );

    // FALLBACK: Use JavaScript sentiment analysis
    // This prevents the page from hanging when Python is unavailable
    try {
      const categorizedComments = {
        positive: [],
        neutral: [],
        negative: [],
      };

      comments.forEach((comment) => {
        const text = comment.answer || comment.comment || "";
        const analysis = sentimentLib.analyze(text);

        if (analysis.score > 0) {
          categorizedComments.positive.push(text);
        } else if (analysis.score < 0) {
          categorizedComments.negative.push(text);
        } else {
          categorizedComments.neutral.push(text);
        }
      });

      return {
        summary: {
          total_comments: comments.length,
          positive_count: categorizedComments.positive.length,
          neutral_count: categorizedComments.neutral.length,
          negative_count: categorizedComments.negative.length,
          positive_percentage: (
            (categorizedComments.positive.length / comments.length) *
            100
          ).toFixed(2),
          neutral_percentage: (
            (categorizedComments.neutral.length / comments.length) *
            100
          ).toFixed(2),
          negative_percentage: (
            (categorizedComments.negative.length / comments.length) *
            100
          ).toFixed(2),
        },
        insights: ["Using fallback JavaScript sentiment analysis"],
        recommendations: [],
        comments: categorizedComments,
        analyzed_feedbacks: [],
        language_breakdown: {},
        warning: "Python sentiment analysis unavailable - using fallback",
      };
    } catch (fallbackError) {
      console.error("Fallback analysis also failed:", fallbackError);
      throw error; // Throw original error
    }
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
      previousEventId: previousEvent._id,
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
async function analyzeResponses(
  responses,
  questionTypeMap,
  questionsSource = [],
) {
  try {
    // Build a map of Title -> Set of Options to detect collision
    const titleToOptionsMap = {};
    if (Array.isArray(questionsSource)) {
      questionsSource.forEach((q) => {
        if (q.options && Array.isArray(q.options) && q.title) {
          if (!titleToOptionsMap[q.title]) {
            titleToOptionsMap[q.title] = new Set();
          }
          q.options.forEach((opt) =>
            titleToOptionsMap[q.title].add(String(opt).trim()),
          );
        }
      });
    }

    // Extract text content from responses (only text-based questions, not ratings)
    const textContents = [];
    const textMetadata = [];

    responses.forEach((response) => {
      if (response.responses && Array.isArray(response.responses)) {
        // Extract text from text-based questions only
        response.responses.forEach((q) => {
          // Skip if answer is a number (scale/rating)
          if (typeof q.answer === "number") return;

          // Skip if answer is a string
          if (typeof q.answer === "string") {
            const trimmed = q.answer.trim();
            // Skip pure numbers or very short responses (likely ratings)
            if (/^\d+$/.test(trimmed) && trimmed.length <= 2) return;
            // Skip if too short to be meaningful text (less than 3 characters)
            if (trimmed.length < 3) return;

            const qType = questionTypeMap
              ? questionTypeMap[q.questionId] ||
                questionTypeMap[q.questionTitle]
              : null;

            // Only analyze paragraph and short_answer for sentiment
            if (qType === "paragraph" || qType === "short_answer") {
              // Safety Check: Is this "text" actually a known option for a question with this title?
              // This handles the case where "Untitled Question" (Text) overlaps with "Untitled Question" (MC)
              if (
                titleToOptionsMap[q.questionTitle] &&
                titleToOptionsMap[q.questionTitle].has(trimmed)
              ) {
                return; // Skip: This is an MC option masquerading as text due to ID mismatch
              }

              textContents.push(trimmed);
              textMetadata.push({
                questionId: q.questionId,
                questionTitle: q.questionTitle,
                questionType: qType,
                text: trimmed,
              });
            }
          }
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
        questionBreakdown: [],
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
      // Map analyzed comments back to questions
      const analyzedFeedbacks = pythonResult.analyzed_feedbacks || [];
      const questionMap = new Map();

      analyzedFeedbacks.forEach((analysis, index) => {
        const meta = textMetadata[index];
        if (!meta) return;

        const qId = meta.questionId || meta.questionTitle;
        if (!questionMap.has(qId)) {
          questionMap.set(qId, {
            questionId: meta.questionId,
            questionTitle: meta.questionTitle,
            questionType: meta.questionType,
            responseCount: 0,
            responses: [],
          });
        }

        const qData = questionMap.get(qId);
        qData.responseCount++;
        qData.responses.push({
          text: meta.text,
          sentiment: analysis.analysis?.sentiment || "neutral",
          confidence: analysis.analysis?.confidence || 0,
          label: analysis.analysis?.label || "neutral",
        });
      });

      // Calculate sentiment breakdown per question
      for (const qData of questionMap.values()) {
        const breakdown = {
          positive: { count: 0, percentage: 0 },
          neutral: { count: 0, percentage: 0 },
          negative: { count: 0, percentage: 0 },
        };

        qData.responses.forEach((r) => {
          const sentiment = r.sentiment || "neutral";
          if (breakdown[sentiment]) {
            breakdown[sentiment].count++;
          }
        });

        const total = qData.responseCount;
        if (total > 0) {
          breakdown.positive.percentage = Math.round(
            (breakdown.positive.count / total) * 100,
          );
          breakdown.neutral.percentage = Math.round(
            (breakdown.neutral.count / total) * 100,
          );
          breakdown.negative.percentage = Math.round(
            (breakdown.negative.count / total) * 100,
          );
        }

        qData.sentimentBreakdown = breakdown;
      }

      return {
        sentimentBreakdown: pythonResult.summary,
        analyzed_responses: analyzedFeedbacks,
        categorizedComments: pythonResult.categorized_comments,
        questionBreakdown: Array.from(questionMap.values()),
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
  const cwdVenvPathWin = path.join(
    process.cwd(),
    "venv",
    "Scripts",
    "python.exe",
  );
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
  console.log(
    "⚠️ No virtual environment found. Using system python with PYTHONPATH.",
  );
  if (process.platform === "win32") return "python";
  return "python3";
}

/**
 * Configure PythonShell options with custom PYTHONPATH
 */
function getPythonOptions(scriptPath) {
  const pythonPath = getPythonPath();
  const env = { ...process.env };

  // Detect if running on Render
  const isRender =
    process.env.RENDER === "true" || process.cwd().includes("/opt/render");

  // Only inject PYTHONPATH if we are NOT using a venv
  // (If using venv, libraries are already in path)
  const isVenv = pythonPath.includes("venv");

  if (!isVenv) {
    const pythonLibs = path.resolve(__dirname, "../../../python_libs");
    const renderLibs = "/opt/render/project/src/python_libs";
    const userSitePackages = isRender
      ? "/opt/render/.local/lib/python3.11/site-packages" // Render user site-packages
      : "";

    let pythonPathEnv = process.env.PYTHONPATH || "";

    // Add user site-packages for Render (pip install --user)
    if (isRender && userSitePackages) {
      pythonPathEnv = `${userSitePackages}${path.delimiter}${pythonPathEnv}`;
      console.log(
        `🔧 Injecting PYTHONPATH (Render user site): ${userSitePackages}`,
      );
    }

    if (require("fs").existsSync(pythonLibs)) {
      pythonPathEnv = `${pythonLibs}${path.delimiter}${pythonPathEnv}`;
      console.log(`🔧 Injecting PYTHONPATH (Local libs): ${pythonLibs}`);
    } else if (require("fs").existsSync(renderLibs)) {
      pythonPathEnv = `${renderLibs}${path.delimiter}${pythonPathEnv}`;
      console.log(`🔧 Injecting PYTHONPATH (Render libs): ${renderLibs}`);
    }
    env.PYTHONPATH = pythonPathEnv;
  }

  // Set NLTK_DATA correctly based on environment
  const localNltkData = path.resolve(__dirname, "../../../nltk_data");

  // Render deployment logs show NLTK data is in home dir: /opt/render/nltk_data
  const renderHomeNltkData = "/opt/render/nltk_data";
  const renderProjectNltkData = "/opt/render/project/src/nltk_data";

  if (isRender) {
    // Check if data exists in home dir first (most likely based on logs)
    if (require("fs").existsSync(renderHomeNltkData)) {
      env.NLTK_DATA = renderHomeNltkData;
      console.log(`🔧 NLTK_DATA (Render Home): ${renderHomeNltkData}`);
    } else {
      // Fallback to project dir
      env.NLTK_DATA = renderProjectNltkData;
      console.log(`🔧 NLTK_DATA (Render Project): ${renderProjectNltkData}`);
    }
  } else if (require("fs").existsSync(localNltkData)) {
    env.NLTK_DATA = localNltkData;
    console.log(`🔧 NLTK_DATA (Local): ${localNltkData}`);
  }

  const scriptDir = path.dirname(scriptPath);
  console.log(`🔧 Python Options - Script Dir: ${scriptDir}`);

  return {
    mode: "text",
    pythonPath: pythonPath,
    pythonOptions: ["-u"],
    scriptPath: scriptDir, // Explicitly set directory
    env: env,
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

  let result;

  // Use Python for sentiment analysis (pure lexicon, no heavy ML libs)
  try {
    // Fetch custom lexicon from DB (MIS lexicon management)
    // Only send minimal data: { word, sentiment } to reduce payload size
    const dbLexicon = await Lexicon.find().select("word sentiment").lean();
    const minimalLexicon = dbLexicon.map((entry) => ({
      word: entry.word,
      sentiment: entry.sentiment,
    }));

    const pythonPromise = analyzeSingleWithPython(cleanText, minimalLexicon);

    // 30 second timeout for Python
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Python analysis timed out")), 30000),
    );

    result = await Promise.race([pythonPromise, timeoutPromise]);
    console.log(
      `✅ Python analysis succeeded for: "${cleanText.substring(0, 30)}..."`,
    );
  } catch (error) {
    console.error(`❌ Python analysis failed: ${error.message}`);
    throw error; // No fallback - Python should work with optimized memory usage
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
    let stderrOutput = "";

    pyshell.on("message", (message) => {
      result += message;
    });

    pyshell.on("stderr", (stderr) => {
      stderrOutput += stderr;
      console.log("Python stderr (analyzeSingle):", stderr);
    });

    pyshell.end((err) => {
      if (err) {
        console.error("Python error:", err);
        console.error("Python stderr:", stderrOutput);
        reject(err);
      } else {
        try {
          if (!result || result.trim() === "") {
            console.error(
              "Python returned empty result. Stderr:",
              stderrOutput,
            );
            reject(new Error("Python returned empty result"));
            return;
          }
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
          console.error("Failed to parse Python output:", result);
          console.error("Stderr:", stderrOutput);
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
