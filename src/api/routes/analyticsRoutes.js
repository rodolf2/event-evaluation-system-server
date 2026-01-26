const express = require("express");
const router = express.Router();
const { requireRole } = require("../../middlewares/auth");
const analyticsController = require("../controllers/analyticsController");
const reportController = require("../controllers/reportController");

// GET /api/analytics/form/:formId - Get analytics for a specific form
router.get(
  "/form/:formId",
  requireRole([
    "psas",
    "club-officer",
    "school-admin",
    "senior-management",
    "club-adviser",
    "mis",
    "evaluator",
    "guest-speaker",
  ]),
  analyticsController.getFormAnalytics,
);

// GET /api/analytics/my-forms - Get analytics summary for all user's forms
router.get(
  "/my-forms",
  requireRole([
    "psas",
    "club-officer",
    "school-admin",
    "senior-management",
    "club-adviser",
    "mis",
    "evaluator",
    "guest-speaker",
  ]),
  analyticsController.getMyFormsAnalytics,
);

// NEW: Dynamic Report Data Endpoints
// GET /api/analytics/reports/:reportId/quantitative - Get dynamic quantitative data
router.get(
  "/reports/:reportId/quantitative",
  requireRole([
    "psas",
    "club-officer",
    "school-admin",
    "senior-management",
    "club-adviser",
    "mis",
    "evaluator",
    "guest-speaker",
  ]),
  reportController.getDynamicQuantitativeData,
);

// GET /api/analytics/reports/:reportId/qualitative - Get dynamic qualitative data
router.get(
  "/reports/:reportId/qualitative",
  requireRole([
    "psas",
    "club-officer",
    "school-admin",
    "senior-management",
    "club-adviser",
    "mis",
    "evaluator",
    "guest-speaker",
  ]),
  reportController.getDynamicQualitativeData,
);

// GET /api/analytics/reports/:reportId/comments - Get dynamic comments data
router.get(
  "/reports/:reportId/comments",
  requireRole([
    "psas",
    "club-officer",
    "school-admin",
    "senior-management",
    "club-adviser",
    "mis",
    "evaluator",
    "guest-speaker",
  ]),
  reportController.getDynamicCommentsData,
);

// GET /api/analytics/reports/all - Get all available reports with live metrics
router.get(
  "/reports/all",
  requireRole([
    "psas",
    "club-officer",
    "school-admin",
    "senior-management",
    "club-adviser",
    "mis",
    "evaluator",
    "guest-speaker",
  ]),
  reportController.getAllReportsWithLiveData,
);

// GET /api/analytics/reports - Get all reports with live data
router.get(
  "/reports",
  requireRole([
    "psas",
    "club-officer",
    "school-admin",
    "senior-management",
    "club-adviser",
    "mis",
    "evaluator",
    "guest-speaker",
  ]),
  reportController.getAllReportsWithLiveData,
);

// POST /api/analytics/reports/generate/:formId - Generate a report
router.post(
  "/reports/generate/:formId",
  requireRole([
    "psas",
    "club-officer",
    "school-admin",
    "senior-management",
    "club-adviser",
    "mis",
    "evaluator",
    "guest-speaker",
  ]),
  reportController.generateReport,
);

module.exports = router;
