const express = require("express");
const router = express.Router();
const {
  shareReport,
  getSharedReports,
  getReportSharing,
  generatePDFReport,
  getSchoolAdmins,
} = require("../controllers/reportsController");
const { requireAuth } = require("../../middlewares/auth");

// Get senior management for report sharing (requires authentication)
router.get("/senior-management", requireAuth, getSchoolAdmins);

// Share a report with school admins (requires authentication)
router.post("/:reportId/share", requireAuth, shareReport);

// Get reports shared with the logged-in school admin (requires authentication)
router.get("/my-shared", requireAuth, getSharedReports);

// Get sharing details for a specific report (requires authentication)
router.get("/:reportId/sharing", requireAuth, getReportSharing);

// Generate PDF report (requires authentication)
router.post("/:reportId/generate-pdf", requireAuth, generatePDFReport);

module.exports = router;
