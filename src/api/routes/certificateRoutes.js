const express = require("express");
const router = express.Router();
const Certificate = require("../../models/Certificate");
const CertificateController = require("../controllers/certificateController");
const { requireAuth } = require("../../middlewares/auth");

console.log("[CERT-ROUTES] Certificate routes file loaded");

// IMPORTANT: More specific routes MUST come before generic :id routes
// Static paths first, then paths with fixed segments, then generic :id

// Static routes - GET /api/certificates/my
router.get(
  "/my",
  requireAuth,
  CertificateController.getMyCertificates.bind(CertificateController)
);

// Static routes - GET /api/certificates/latest/id
router.get(
  "/latest/id",
  requireAuth,
  CertificateController.getLatestCertificateId.bind(CertificateController)
);

// Static routes - POST /api/certificates/generate
router.post(
  "/generate",
  requireAuth,
  CertificateController.generateCertificate.bind(CertificateController)
);

// Static routes - POST /api/certificates/generate-bulk
router.post(
  "/generate-bulk",
  requireAuth,
  CertificateController.generateBulkCertificates.bind(CertificateController)
);

// Fixed segment routes - GET /api/certificates/form/:formId
router.get(
  "/form/:formId",
  requireAuth,
  CertificateController.getCertificatesForForm.bind(CertificateController)
);

// Fixed segment routes - GET /api/certificates/download/:certificateId
router.get(
  "/download/:certificateId",
  requireAuth,
  CertificateController.downloadCertificate.bind(CertificateController)
);

// Fixed segment routes - GET /api/certificates/:certificateId/validate
// MUST BE PLACED BEFORE generic /:certificateId routes
console.log(
  "[CERT-ROUTES] Registering validate route: GET /:templateId/validate"
);
router.get("/:templateId/validate", requireAuth, async (req, res) => {
  try {
    const { templateId } = req.params;
    console.log(
      `[CERTIFICATE VALIDATE] Request received for template: ${templateId}`
    );

    // Import required modules
    const fs = require("fs");
    const path = require("path");

    // Build the template path
    // From: server/src/api/routes/certificateRoutes.js
    // To: client/src/templates/{templateId}.json
    const templatePath = path.resolve(
      __dirname,
      "../../../../client/src/templates",
      `${templateId}.json`
    );

    console.log(`[CERTIFICATE VALIDATE] Template path: ${templatePath}`);

    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      console.warn(
        `[CERTIFICATE VALIDATE] Template file not found: ${templatePath}`
      );
      return res.status(404).json({
        success: false,
        message: "Certificate template not found",
        data: { isValid: false, message: "Template file does not exist" },
      });
    }

    console.log(`[CERTIFICATE VALIDATE] Template file found, parsing...`);

    // Try to parse the template JSON
    try {
      const templateData = JSON.parse(fs.readFileSync(templatePath, "utf8"));
      console.log(`[CERTIFICATE VALIDATE] Successfully parsed template JSON`);

      // Basic validation - check if it has required Fabric.js properties
      if (!templateData.objects || !Array.isArray(templateData.objects)) {
        console.warn(`[CERTIFICATE VALIDATE] Template missing objects array`);
        return res.status(400).json({
          success: false,
          message: "Invalid certificate template format",
          data: {
            isValid: false,
            message: "Template missing required objects array",
          },
        });
      }

      // Check if template has at least one object
      if (templateData.objects.length === 0) {
        console.warn(`[CERTIFICATE VALIDATE] Template is empty`);
        return res.status(400).json({
          success: false,
          message: "Certificate template is empty",
          data: { isValid: false, message: "Template contains no objects" },
        });
      }

      console.log(
        `[CERTIFICATE VALIDATE] ✓ Template ${templateId} is VALID with ${templateData.objects.length} objects`
      );
      return res.status(200).json({
        success: true,
        message: "Certificate template is valid",
        data: {
          isValid: true,
          message: `Template contains ${templateData.objects.length} objects`,
          objectCount: templateData.objects.length,
        },
      });
    } catch (parseError) {
      console.error(
        `[CERTIFICATE VALIDATE] JSON parse error:`,
        parseError.message
      );
      return res.status(400).json({
        success: false,
        message: "Certificate template contains invalid JSON",
        data: { isValid: false, message: "Template JSON is malformed" },
      });
    }
  } catch (error) {
    console.error(`[CERTIFICATE VALIDATE] Unhandled error:`, error);
    return res.status(500).json({
      success: false,
      message: "Failed to validate certificate template",
      error: error.message,
    });
  }
});

// GET /api/certificates/stats - Get certificate statistics
router.get(
  "/stats",
  requireAuth,
  CertificateController.getCertificateStats.bind(CertificateController)
);

// PUT /api/certificates/customizations/:formId - Update form certificate customizations
router.put(
  "/customizations/:formId",
  requireAuth,
  CertificateController.updateFormCustomizations.bind(CertificateController)
);

// GET /api/certificates/customizations/:formId - Get form certificate customizations
router.get(
  "/customizations/:formId",
  requireAuth,
  CertificateController.getFormCustomizations.bind(CertificateController)
);

// GET /api/certificates/templates - Get available certificate templates
router.get("/templates", requireAuth, async (req, res) => {
  try {
    // For now, return static templates - in a real app, these would be from a database
    const templates = [
      {
        id: "classic-blue",
        name: "Classic Blue",
        preview: "/templates/classic-blue.json",
      },
      {
        id: "elegant-gold",
        name: "Elegant Gold",
        preview: "/templates/elegant-gold.json",
      },
      {
        id: "global-conference-recognition",
        name: "Global Conference Recognition",
        preview: "/templates/global-conference-recognition.json",
      },
      {
        id: "leadership-workshop-completion",
        name: "Leadership Workshop Completion",
        preview: "/templates/leadership-workshop-completion.json",
      },
      {
        id: "modern-red",
        name: "Modern Red",
        preview: "/templates/modern-red.json",
      },
      {
        id: "professional-green",
        name: "Professional Green",
        preview: "/templates/professional-green.json",
      },
      {
        id: "simple-black",
        name: "Simple Black",
        preview: "/templates/simple-black.json",
      },
      {
        id: "skills-training-achievement",
        name: "Skills Training Achievement",
        preview: "/templates/skills-training-achievement.json",
      },
      {
        id: "tech-innovation-summit",
        name: "Tech Innovation Summit",
        preview: "/templates/tech-innovation-summit.json",
      },
      {
        id: "vintage-purple",
        name: "Vintage Purple",
        preview: "/templates/vintage-purple.json",
      },
    ];

    res.status(200).json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error("Error fetching certificate templates:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch certificate templates",
      error: error.message,
    });
  }
});

// ============================================================
// IMPORTANT: Generic routes MUST come last (after all specific routes)
// ============================================================

// GET /api/certificates/user/:userId - Get user certificates
router.get(
  "/user/:userId",
  requireAuth,
  CertificateController.getUserCertificates.bind(CertificateController)
);

// GET /api/certificates/event/:eventId - Get event certificates
router.get(
  "/event/:eventId",
  requireAuth,
  CertificateController.getEventCertificates.bind(CertificateController)
);

// POST /api/certificates/:certificateId/resend - Resend certificate
router.post(
  "/:certificateId/resend",
  requireAuth,
  CertificateController.resendCertificate.bind(CertificateController)
);

// GET /api/certificates/:certificateId - Get a specific certificate
router.get(
  "/:certificateId",
  requireAuth,
  CertificateController.getCertificate.bind(CertificateController)
);

// PUT /api/certificates/:certificateId - Update a certificate
router.put(
  "/:certificateId",
  requireAuth,
  CertificateController.updateCertificate.bind(CertificateController)
);

// DELETE /api/certificates/:certificateId - Delete a certificate
router.delete(
  "/:certificateId",
  requireAuth,
  CertificateController.deleteCertificate.bind(CertificateController)
);

console.log("[CERT-ROUTES] All certificate routes registered successfully");
module.exports = router;
