const express = require("express");
const router = express.Router();
const GuestToken = require("../../models/GuestToken");
const Form = require("../../models/Form");
const { requireAuth, requireRole } = require("../../middlewares/auth");
const { sendEmail } = require("../../utils/email");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");

// Configure multer for CSV uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads/csv");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `guests-${Date.now()}.csv`);
  },
});
const upload = multer({ storage });

// Generate guest access email HTML
const generateGuestAccessEmailHtml = ({
  name,
  eventName,
  accessLink,
  expiresAt,
}) => {
  const expiryDate = new Date(expiresAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1F3463 0%, #2d4a8c 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Event Report Access</h1>
        <p style="color: #e0e7ff; margin: 10px 0 0 0;">La Verdad Christian College - Event Evaluation System</p>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; color: #374151;">Hello <strong>${name}</strong>,</p>
        
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          You have been granted access to view the evaluation report for:
        </p>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-weight: bold; color: #1F3463; font-size: 18px;">${eventName}</p>
        </div>
        
        <p style="font-size: 14px; color: #6b7280; margin-bottom: 20px;">
          This is a read-only access link that will expire on <strong>${expiryDate}</strong>.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${accessLink}" 
             style="display: inline-block; background: #1F3463; color: white; padding: 14px 28px; 
                    text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            View Report
          </a>
        </div>
        
        <p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${accessLink}" style="color: #1F3463; word-break: break-all;">${accessLink}</a>
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">
          © ${new Date().getFullYear()} La Verdad Christian College - Apalit, Pampanga
        </p>
      </div>
    </div>
  `;
};

// POST /api/guest/generate-token - Generate a single token
router.post(
  "/generate-token",
  requireAuth,
  requireRole(["psas", "superadmin", "club-officer"]),
  async (req, res) => {
    try {
      const { email, name, reportId, expirationDays = 48 } = req.body;

      if (!email || !name || !reportId) {
        return res.status(400).json({
          success: false,
          message: "Email, name, and reportId are required",
        });
      }

      // expirationDays is now hours (48-168 hours range)
      const expirationHours = parseInt(expirationDays);
      if (expirationHours < 48 || expirationHours > 168) {
        return res.status(400).json({
          success: false,
          message: "Access duration must be between 48 and 168 hours",
        });
      }

      // Verify report exists
      const report = await Form.findById(reportId);
      if (!report) {
        return res.status(404).json({
          success: false,
          message: "Report not found",
        });
      }

      // Generate token
      const token = GuestToken.generateToken();
      const expiresAt = new Date();
      expiresAt.setTime(expiresAt.getTime() + expirationHours * 60 * 60 * 1000);

      const guestToken = new GuestToken({
        token,
        email,
        name,
        reportId,
        eventId: report.eventId,
        expiresAt,
        expirationDays: Math.ceil(expirationHours / 24), // Store as days for display
        createdBy: req.user._id,
      });

      await guestToken.save();

      const baseUrl = process.env.CLIENT_URL || "http://localhost:5173";
      const accessLink = `${baseUrl}/guest/access?token=${token}`;

      res.status(201).json({
        success: true,
        message: "Guest token created successfully",
        data: {
          tokenId: guestToken._id,
          token,
          accessLink,
          email,
          name,
          expiresAt,
        },
      });
    } catch (error) {
      console.error("Error generating guest token:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate guest token",
        error: error.message,
      });
    }
  },
);

// POST /api/guest/generate-tokens - Generate tokens from CSV
router.post(
  "/generate-tokens",
  requireAuth,
  requireRole(["psas", "superadmin", "club-officer"]),
  upload.single("csvFile"),
  async (req, res) => {
    try {
      const { eventId } = req.body;
      const expirationDays = parseInt(req.body.expirationDays) || 7;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "CSV file is required",
        });
      }

      const guests = [];
      const filePath = req.file.path;

      // Parse CSV
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on("data", (row) => {
            if (row.email && row.name) {
              guests.push({
                email: row.email.trim().toLowerCase(),
                name: row.name.trim(),
              });
            }
          })
          .on("end", resolve)
          .on("error", reject);
      });

      // Clean up file
      fs.unlinkSync(filePath);

      if (guests.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            "No valid guests found in CSV. Ensure columns 'email' and 'name' exist.",
        });
      }

      // Generate tokens for each guest
      const baseUrl = process.env.CLIENT_URL || "http://localhost:5173";
      const tokens = [];

      for (const guest of guests) {
        const token = GuestToken.generateToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expirationDays);

        const guestToken = new GuestToken({
          token,
          email: guest.email,
          name: guest.name,
          reportId: eventId,
          expiresAt,
          expirationDays,
          createdBy: req.user._id,
        });

        await guestToken.save();

        tokens.push({
          tokenId: guestToken._id,
          token,
          accessLink: `${baseUrl}/guest/access?token=${token}`,
          email: guest.email,
          name: guest.name,
          expiresAt,
        });
      }

      res.status(201).json({
        success: true,
        message: `Generated ${tokens.length} guest tokens`,
        data: tokens,
      });
    } catch (error) {
      console.error("Error generating guest tokens:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate guest tokens",
        error: error.message,
      });
    }
  },
);

// POST /api/guest/validate-token - Validate a token (public)
router.post("/validate-token", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token is required",
      });
    }

    const guestToken = await GuestToken.findOne({ token })
      .populate("reportId", "title eventId")
      .populate("createdBy", "name");

    if (!guestToken) {
      return res.status(404).json({
        success: false,
        message: "Invalid token",
      });
    }

    if (!guestToken.isValid()) {
      return res.status(403).json({
        success: false,
        message: guestToken.revoked
          ? "This access has been revoked"
          : "This access link has expired",
      });
    }

    // Record access
    await guestToken.recordAccess();

    res.json({
      success: true,
      message: "Token is valid",
      data: {
        name: guestToken.name,
        email: guestToken.email,
        reportId: guestToken.reportId._id,
        reportTitle: guestToken.reportId.title,
        expiresAt: guestToken.expiresAt,
        role: "speaker",
        reference_id: guestToken.reportId._id,
      },
    });
  } catch (error) {
    console.error("Error validating token:", error);
    res.status(500).json({
      success: false,
      message: "Failed to validate token",
      error: error.message,
    });
  }
});

// GET /api/guest/report/:token - Get report data for guest (public)
router.get("/report/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const guestToken = await GuestToken.findOne({ token }).populate("reportId");

    if (!guestToken) {
      return res.status(404).json({
        success: false,
        message: "Invalid access token",
      });
    }

    if (!guestToken.isValid()) {
      return res.status(403).json({
        success: false,
        message: guestToken.revoked
          ? "This access has been revoked"
          : "This access link has expired",
      });
    }

    // Record access
    await guestToken.recordAccess();

    const report = guestToken.reportId;

    res.json({
      success: true,
      data: {
        report,
        guestInfo: {
          name: guestToken.name,
          email: guestToken.email,
          expiresAt: guestToken.expiresAt,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching guest report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch report",
      error: error.message,
    });
  }
});

// GET /api/guest/tokens/:reportId - List tokens for a report
router.get(
  "/tokens/:reportId",
  requireAuth,
  requireRole(["psas", "superadmin", "club-officer"]),
  async (req, res) => {
    try {
      const { reportId } = req.params;

      const tokens = await GuestToken.find({ reportId })
        .populate("createdBy", "name")
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        data: tokens.map((t) => ({
          id: t._id,
          email: t.email,
          name: t.name,
          token: t.token,
          expiresAt: t.expiresAt,
          expirationDays: t.expirationDays,
          revoked: t.revoked,
          emailSent: t.emailSent,
          emailSentAt: t.emailSentAt,
          accessedAt: t.accessedAt,
          accessCount: t.accessCount,
          createdBy: t.createdBy?.name,
          createdAt: t.createdAt,
          isValid: t.isValid(),
        })),
      });
    } catch (error) {
      console.error("Error fetching guest tokens:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch guest tokens",
        error: error.message,
      });
    }
  },
);

// DELETE /api/guest/revoke/:tokenId - Revoke a token
router.delete(
  "/revoke/:tokenId",
  requireAuth,
  requireRole(["psas", "superadmin", "club-officer"]),
  async (req, res) => {
    try {
      const { tokenId } = req.params;

      const guestToken = await GuestToken.findById(tokenId);

      if (!guestToken) {
        return res.status(404).json({
          success: false,
          message: "Token not found",
        });
      }

      await guestToken.revokeToken(req.user._id);

      res.json({
        success: true,
        message: "Token revoked successfully",
      });
    } catch (error) {
      console.error("Error revoking token:", error);
      res.status(500).json({
        success: false,
        message: "Failed to revoke token",
        error: error.message,
      });
    }
  },
);

// POST /api/guest/send-email/:tokenId - Send access email
router.post(
  "/send-email/:tokenId",
  requireAuth,
  requireRole(["psas", "superadmin", "club-officer"]),
  async (req, res) => {
    try {
      const { tokenId } = req.params;

      const guestToken = await GuestToken.findById(tokenId).populate(
        "reportId",
        "title",
      );

      if (!guestToken) {
        return res.status(404).json({
          success: false,
          message: "Token not found",
        });
      }

      if (!guestToken.isValid()) {
        return res.status(400).json({
          success: false,
          message: "Cannot send email for expired or revoked token",
        });
      }

      const baseUrl = process.env.CLIENT_URL || "http://localhost:5173";
      const accessLink = `${baseUrl}/guest/access?token=${guestToken.token}`;

      const htmlContent = generateGuestAccessEmailHtml({
        name: guestToken.name,
        eventName: guestToken.reportId.title || "Event Report",
        accessLink,
        expiresAt: guestToken.expiresAt,
      });

      await sendEmail({
        to: guestToken.email,
        subject: `Access to Event Report: ${
          guestToken.reportId.title || "Event Report"
        }`,
        html: htmlContent,
      });

      // Update token
      guestToken.emailSent = true;
      guestToken.emailSentAt = new Date();
      await guestToken.save();

      res.json({
        success: true,
        message: "Access email sent successfully",
      });
    } catch (error) {
      console.error("Error sending access email:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send access email",
        error: error.message,
      });
    }
  },
);

// POST /api/guest/revoke-token - Revoke by token string (legacy support)
router.post(
  "/revoke-token",
  requireAuth,
  requireRole(["psas", "superadmin"]),
  async (req, res) => {
    try {
      const { token } = req.body;

      const guestToken = await GuestToken.findOne({ token });

      if (!guestToken) {
        return res.status(404).json({
          success: false,
          message: "Token not found",
        });
      }

      await guestToken.revokeToken(req.user._id);

      res.json({
        success: true,
        message: "Token revoked successfully",
      });
    } catch (error) {
      console.error("Error revoking token:", error);
      res.status(500).json({
        success: false,
        message: "Failed to revoke token",
        error: error.message,
      });
    }
  },
);

// GET /api/guest/event-tokens - Get tokens by event (legacy support)
router.get(
  "/event-tokens",
  requireAuth,
  requireRole(["psas", "superadmin"]),
  async (req, res) => {
    try {
      const { eventId } = req.query;

      if (!eventId) {
        return res.status(400).json({
          success: false,
          message: "eventId query parameter is required",
        });
      }

      const tokens = await GuestToken.find({ reportId: eventId })
        .populate("createdBy", "name")
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        data: tokens.map((t) => ({
          id: t._id,
          email: t.email,
          name: t.name,
          token: t.token,
          expiresAt: t.expiresAt,
          revoked: t.revoked,
          emailSent: t.emailSent,
          accessedAt: t.accessedAt,
          accessCount: t.accessCount,
          isValid: t.isValid(),
        })),
      });
    } catch (error) {
      console.error("Error fetching event tokens:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch event tokens",
        error: error.message,
      });
    }
  },
);

// ============================================
// EVALUATOR TOKEN ROUTES
// ============================================

const EvaluatorToken = require("../../models/EvaluatorToken");
const {
  generateEvaluatorAccessEmailHtml,
} = require("../../utils/evaluatorEmailTemplate");

// POST /api/guest/evaluator/generate-token - Generate a single evaluator token
router.post(
  "/evaluator/generate-token",
  requireAuth,
  requireRole(["psas", "superadmin", "club-officer"]),
  async (req, res) => {
    try {
      const { email, name, formId } = req.body;

      if (!email || !name || !formId) {
        return res.status(400).json({
          success: false,
          message: "Email, name, and formId are required",
        });
      }

      // Verify form exists
      const form = await Form.findById(formId);
      if (!form) {
        return res.status(404).json({
          success: false,
          message: "Form not found",
        });
      }

      // Calculate expiration based on form's event end date
      // If no end date, default to 7 days from now
      let expiresAt;
      if (form.eventEndDate) {
        // Add 24 hours after event end date to allow for late evaluations
        expiresAt = new Date(form.eventEndDate);
        expiresAt.setHours(expiresAt.getHours() + 24);
      } else {
        // Fallback: 7 days from now
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
      }

      // Generate token
      const token = EvaluatorToken.generateToken();

      const evaluatorToken = new EvaluatorToken({
        token,
        email: email.toLowerCase().trim(),
        name: name.trim(),
        formId,
        eventId: form.eventId,
        expiresAt,
        expirationDays: Math.ceil(
          (expiresAt - new Date()) / (1000 * 60 * 60 * 24),
        ),
        createdBy: req.user._id,
      });

      await evaluatorToken.save();

      const baseUrl = process.env.CLIENT_URL || "http://localhost:5173";
      const accessLink = `${baseUrl}/guest/evaluate?token=${token}`;

      res.status(201).json({
        success: true,
        message: "Evaluator token created successfully",
        data: {
          tokenId: evaluatorToken._id,
          token,
          accessLink,
          email,
          name,
          expiresAt,
        },
      });
    } catch (error) {
      console.error("Error generating evaluator token:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate evaluator token",
        error: error.message,
      });
    }
  },
);

// POST /api/guest/evaluator/validate-token - Validate a token (public)
router.post("/evaluator/validate-token", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token is required",
      });
    }

    const evaluatorToken = await EvaluatorToken.findOne({ token })
      .populate("formId", "title eventId questions")
      .populate("createdBy", "name");

    if (!evaluatorToken) {
      return res.status(404).json({
        success: false,
        message: "Invalid token",
      });
    }

    if (!evaluatorToken.isValid()) {
      return res.status(403).json({
        success: false,
        message: evaluatorToken.revoked
          ? "This access has been revoked"
          : "This access link has expired",
      });
    }

    if (evaluatorToken.completed) {
      return res.status(403).json({
        success: false,
        message: "You have already submitted your evaluation",
        completed: true,
      });
    }

    // Record access
    await evaluatorToken.recordAccess();

    res.json({
      success: true,
      message: "Token is valid",
      data: {
        name: evaluatorToken.name,
        email: evaluatorToken.email,
        formId: evaluatorToken.formId._id,
        formTitle: evaluatorToken.formId.title,
        expiresAt: evaluatorToken.expiresAt,
        completed: evaluatorToken.completed,
      },
    });
  } catch (error) {
    console.error("Error validating evaluator token:", error);
    res.status(500).json({
      success: false,
      message: "Failed to validate token",
      error: error.message,
    });
  }
});

// GET /api/guest/evaluator/form/:token - Get form data for evaluation (public)
router.get("/evaluator/form/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const evaluatorToken = await EvaluatorToken.findOne({ token }).populate(
      "formId",
    );

    if (!evaluatorToken) {
      return res.status(404).json({
        success: false,
        message: "Invalid access token",
      });
    }

    if (!evaluatorToken.isValid()) {
      return res.status(403).json({
        success: false,
        message: evaluatorToken.revoked
          ? "This access has been revoked"
          : "This access link has expired",
      });
    }

    if (evaluatorToken.completed) {
      return res.status(403).json({
        success: false,
        message: "You have already submitted your evaluation",
        completed: true,
      });
    }

    // Record access
    await evaluatorToken.recordAccess();

    const form = evaluatorToken.formId;

    res.json({
      success: true,
      data: {
        form: {
          _id: form._id,
          title: form.title,
          description: form.description,
          questions: form.questions,
          eventDates: form.eventDates,
        },
        evaluatorInfo: {
          name: evaluatorToken.name,
          email: evaluatorToken.email,
          expiresAt: evaluatorToken.expiresAt,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching evaluation form:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch form",
      error: error.message,
    });
  }
});

// POST /api/guest/evaluator/submit/:token - Submit evaluation response (public)
router.post("/evaluator/submit/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { responses } = req.body;

    const evaluatorToken = await EvaluatorToken.findOne({ token }).populate(
      "formId",
    );

    if (!evaluatorToken) {
      return res.status(404).json({
        success: false,
        message: "Invalid access token",
      });
    }

    if (!evaluatorToken.canSubmit()) {
      if (evaluatorToken.completed) {
        return res.status(403).json({
          success: false,
          message: "You have already submitted your evaluation",
        });
      }
      return res.status(403).json({
        success: false,
        message: "This access link is no longer valid",
      });
    }

    // Get the form and add response to its responses array
    const form = evaluatorToken.formId;

    // Create the response object
    const newResponse = {
      responses: responses,
      respondentEmail: null, // Always null for complete anonymity, even for guest evaluators
      respondentName: null,
      submittedAt: new Date(),
    };

    // Push to form's responses array and increment count
    form.responses.push(newResponse);
    form.responseCount = (form.responseCount || 0) + 1;
    await form.save();

    // Get the ID of the newly added response
    const addedResponse = form.responses[form.responses.length - 1];

    // Mark token as completed
    await evaluatorToken.markCompleted(addedResponse._id);

    res.json({
      success: true,
      message: "Evaluation submitted successfully",
      data: {
        responseId: addedResponse._id,
      },
    });
  } catch (error) {
    console.error("Error submitting evaluation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit evaluation",
      error: error.message,
    });
  }
});

// POST /api/guest/evaluator/send-email/:tokenId - Send access email
router.post(
  "/evaluator/send-email/:tokenId",
  requireAuth,
  requireRole(["psas", "superadmin", "club-officer"]),
  async (req, res) => {
    try {
      const { tokenId } = req.params;

      const evaluatorToken = await EvaluatorToken.findById(tokenId).populate(
        "formId",
        "title",
      );

      if (!evaluatorToken) {
        return res.status(404).json({
          success: false,
          message: "Token not found",
        });
      }

      if (!evaluatorToken.isValid()) {
        return res.status(400).json({
          success: false,
          message: "Cannot send email for expired or revoked token",
        });
      }

      const baseUrl = process.env.CLIENT_URL || "http://localhost:5173";
      const accessLink = `${baseUrl}/guest/evaluate?token=${evaluatorToken.token}`;

      const htmlContent = generateEvaluatorAccessEmailHtml({
        name: evaluatorToken.name,
        eventName: evaluatorToken.formId.title || "Event Evaluation",
        formTitle: evaluatorToken.formId.title || "Evaluation Form",
        accessLink,
        expiresAt: evaluatorToken.expiresAt,
      });

      await sendEmail({
        to: evaluatorToken.email,
        subject: `Complete Your Evaluation: ${
          evaluatorToken.formId.title || "Event Evaluation"
        }`,
        html: htmlContent,
      });

      // Update token
      evaluatorToken.emailSent = true;
      evaluatorToken.emailSentAt = new Date();
      await evaluatorToken.save();

      res.json({
        success: true,
        message: "Evaluation access email sent successfully",
      });
    } catch (error) {
      console.error("Error sending evaluator access email:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send access email",
        error: error.message,
      });
    }
  },
);

// GET /api/guest/evaluator/tokens/:formId - List tokens for a form
router.get(
  "/evaluator/tokens/:formId",
  requireAuth,
  requireRole(["psas", "superadmin", "club-officer"]),
  async (req, res) => {
    try {
      const { formId } = req.params;

      const tokens = await EvaluatorToken.find({ formId })
        .populate("createdBy", "name")
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        data: tokens.map((t) => ({
          id: t._id,
          email: t.email,
          name: t.name,
          token: t.token,
          expiresAt: t.expiresAt,
          expirationDays: t.expirationDays,
          revoked: t.revoked,
          emailSent: t.emailSent,
          emailSentAt: t.emailSentAt,
          accessedAt: t.accessedAt,
          accessCount: t.accessCount,
          completed: t.completed,
          completedAt: t.completedAt,
          createdBy: t.createdBy?.name,
          createdAt: t.createdAt,
          isValid: t.isValid(),
        })),
      });
    } catch (error) {
      console.error("Error fetching evaluator tokens:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch evaluator tokens",
        error: error.message,
      });
    }
  },
);

// DELETE /api/guest/evaluator/revoke/:tokenId - Revoke a token
router.delete(
  "/evaluator/revoke/:tokenId",
  requireAuth,
  requireRole(["psas", "superadmin", "club-officer"]),
  async (req, res) => {
    try {
      const { tokenId } = req.params;

      const evaluatorToken = await EvaluatorToken.findById(tokenId);

      if (!evaluatorToken) {
        return res.status(404).json({
          success: false,
          message: "Token not found",
        });
      }

      await evaluatorToken.revokeToken(req.user._id);

      res.json({
        success: true,
        message: "Token revoked successfully",
      });
    } catch (error) {
      console.error("Error revoking evaluator token:", error);
      res.status(500).json({
        success: false,
        message: "Failed to revoke token",
        error: error.message,
      });
    }
  },
);

module.exports = router;
