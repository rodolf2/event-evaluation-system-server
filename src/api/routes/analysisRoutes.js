const express = require("express");
const router = express.Router();
const analysisController = require("../controllers/analysisController");
const { requireRole } = require("../../middlewares/auth");
const path = require("path");
const { PythonShell } = require("python-shell");

// All analysis routes require admin or student access
router.use(requireRole(["psas", "school-admin", "mis"]));

// @route   GET /api/analysis/event/:eventId/average-rating
// @desc    Get the average rating for a specific event
// @access  Private (admin, student)
router.get(
  "/event/:eventId/average-rating",
  analysisController.getAverageRatingForEvent
);

// @route   GET /api/analysis/event/:eventId/qualitative-report
// @desc    Get a qualitative report for a specific event
// @access  Private (admin, student)
router.get(
  "/event/:eventId/qualitative-report",
  analysisController.getQualitativeReportForEvent
);

// @route   GET /api/analysis/event/:eventId/quantitative-report
// @desc    Get a quantitative report for a specific event
// @access  Private (admin, student)
router.get(
  "/event/:eventId/quantitative-report",
  analysisController.getQuantitativeReportForEvent
);

// @route   POST /api/analysis/test-sentiment
// @desc    Test sentiment analysis with a sample text (for debugging)
// @access  Private (admin)
router.post("/test-sentiment", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Please provide a text to analyze",
      });
    }

    console.log("=== SENTIMENT ANALYSIS TEST ===");
    console.log("Input text:", text);

    // Try Python analysis first
    let pythonResult = null;
    let pythonError = null;
    let usedMethod = "unknown";

    try {
      const scriptPath = path.resolve(__dirname, "../../../text_analysis.py");

      // Find Python executable
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
        pythonPath = "python";
      }

      console.log("Python path:", pythonPath);
      console.log("Script path:", scriptPath);

      pythonResult = await new Promise((resolve, reject) => {
        const pyshell = new PythonShell(scriptPath, {
          pythonPath,
          pythonOptions: ["-u"],
        });

        pyshell.send(
          JSON.stringify({
            action: "generate_report",
            feedbacks: [text],
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
            reject({ error: err.message, stderr: errorOutput });
          } else {
            try {
              resolve(JSON.parse(result));
            } catch (parseErr) {
              reject({ error: "Failed to parse Python result", raw: result });
            }
          }
        });
      });

      usedMethod = "python";
      console.log("✅ Python analysis successful!");
      console.log("Python result:", JSON.stringify(pythonResult, null, 2));
    } catch (error) {
      pythonError = error;
      usedMethod = "javascript_fallback";
      console.log("❌ Python analysis failed:", error);
    }

    // Prepare response
    const response = {
      success: true,
      input: text,
      method: usedMethod,
      pythonAvailable: pythonError === null,
      pythonError: pythonError
        ? pythonError.error || String(pythonError)
        : null,
    };

    if (pythonResult && pythonResult.success) {
      const feedback = pythonResult.analyzed_feedbacks?.[0];
      response.sentiment = feedback?.sentiment || "unknown";
      response.confidence = feedback?.analysis?.confidence || 0;
      response.analysisDetails = feedback?.analysis || {};
      response.summary = pythonResult.summary;
    } else if (pythonResult) {
      response.pythonError = pythonResult.error;
    }

    console.log("=== END TEST ===");
    res.json(response);
  } catch (error) {
    console.error("Test sentiment error:", error);
    res.status(500).json({
      success: false,
      message: "Test failed",
      error: error.message,
    });
  }
});

module.exports = router;
