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

// GET /api/certificates/templates - Get available certificate templates (built-in + custom)
router.get("/templates", requireAuth, async (req, res) => {
  try {
    const CertificateTemplate = require("../../models/CertificateTemplate");

    // Built-in templates
    const builtInTemplates = [
      {
        id: "classic-blue",
        name: "Classic Blue",
        preview: "/templates/classic-blue.json",
        isBuiltIn: true,
      },
      {
        id: "elegant-gold",
        name: "Elegant Gold",
        preview: "/templates/elegant-gold.json",
        isBuiltIn: true,
      },
      {
        id: "global-conference-recognition",
        name: "Global Conference Recognition",
        preview: "/templates/global-conference-recognition.json",
        isBuiltIn: true,
      },
      {
        id: "leadership-workshop-completion",
        name: "Leadership Workshop Completion",
        preview: "/templates/leadership-workshop-completion.json",
        isBuiltIn: true,
      },
      {
        id: "modern-red",
        name: "Modern Red",
        preview: "/templates/modern-red.json",
        isBuiltIn: true,
      },
      {
        id: "professional-green",
        name: "Professional Green",
        preview: "/templates/professional-green.json",
        isBuiltIn: true,
      },
      {
        id: "simple-black",
        name: "Simple Black",
        preview: "/templates/simple-black.json",
        isBuiltIn: true,
      },
      {
        id: "skills-training-achievement",
        name: "Skills Training Achievement",
        preview: "/templates/skills-training-achievement.json",
        isBuiltIn: true,
      },
      {
        id: "tech-innovation-summit",
        name: "Tech Innovation Summit",
        preview: "/templates/tech-innovation-summit.json",
        isBuiltIn: true,
      },
      {
        id: "vintage-purple",
        name: "Vintage Purple",
        preview: "/templates/vintage-purple.json",
        isBuiltIn: true,
      },
    ];

    // Fetch custom templates from database (user's own + public)
    const customTemplates = await CertificateTemplate.find({
      $or: [{ createdBy: req.user._id }, { isPublic: true }],
    })
      .sort({ createdAt: -1 })
      .lean();

    // Format custom templates to match built-in template structure
    const formattedCustomTemplates = customTemplates.map((t) => ({
      id: t._id.toString(),
      name: t.name,
      description: t.description,
      thumbnail: t.thumbnail,
      category: t.category || "custom",
      isBuiltIn: false,
      isOwner: t.createdBy.toString() === req.user._id.toString(),
      data: t.canvasData,
      createdAt: t.createdAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        builtIn: builtInTemplates,
        custom: formattedCustomTemplates,
        all: [...formattedCustomTemplates, ...builtInTemplates],
      },
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

// POST /api/certificates/templates - Create a new custom template
router.post("/templates", requireAuth, async (req, res) => {
  try {
    const CertificateTemplate = require("../../models/CertificateTemplate");
    const { name, description, canvasData, thumbnail, category, isPublic } =
      req.body;

    if (!name || !canvasData) {
      return res.status(400).json({
        success: false,
        message: "Name and canvas data are required",
      });
    }

    const template = new CertificateTemplate({
      name,
      description: description || "",
      canvasData,
      thumbnail: thumbnail || null,
      category: category || "custom",
      isPublic: isPublic || false,
      createdBy: req.user._id,
    });

    await template.save();

    console.log(
      `[TEMPLATES] Custom template created: ${template.name} by user ${req.user._id}`
    );

    res.status(201).json({
      success: true,
      message: "Template saved successfully",
      data: {
        id: template._id.toString(),
        name: template.name,
        description: template.description,
        category: template.category,
        createdAt: template.createdAt,
      },
    });
  } catch (error) {
    console.error("Error creating certificate template:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save template",
      error: error.message,
    });
  }
});

// DELETE /api/certificates/templates/:templateId - Delete a custom template
router.delete("/templates/:templateId", requireAuth, async (req, res) => {
  try {
    const CertificateTemplate = require("../../models/CertificateTemplate");
    const { templateId } = req.params;

    const template = await CertificateTemplate.findById(templateId);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found",
      });
    }

    // Only allow owner to delete
    if (template.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own templates",
      });
    }

    await CertificateTemplate.findByIdAndDelete(templateId);

    console.log(
      `[TEMPLATES] Custom template deleted: ${template.name} by user ${req.user._id}`
    );

    res.status(200).json({
      success: true,
      message: "Template deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting certificate template:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete template",
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
