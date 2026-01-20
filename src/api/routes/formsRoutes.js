const express = require("express");
const router = express.Router();
const { requireRole } = require("../../middlewares/auth");
const formsController = require("../controllers/formsController");

// GET /api/forms - Get all forms (psas, club-officer, school-admin, mis can access)
router.get(
  "/",
  requireRole(["psas", "club-officer", "senior-management", "mis"]),
  formsController.getAllForms,
);

// GET /api/forms/my-evaluations - Get forms that the current user is assigned to (participants, club-officers)
router.get(
  "/my-evaluations",
  requireRole(["student", "club-officer", "evaluator", "guest-speaker"]),
  formsController.getMyEvaluations,
);

// GET /api/forms/completion-stats - Get participant evaluation completion stats for badge progression
router.get(
  "/completion-stats",
  requireRole(["student", "club-officer", "evaluator", "guest-speaker"]),
  formsController.getCompletionStats,
);

// GET /api/forms/latest/id - Get the ID of the latest form for the authenticated user
router.get(
  "/latest/id",
  requireRole([
    "student",
    "psas",
    "club-officer",
    "senior-management",
    "mis",
    "evaluator",
    "guest-speaker",
  ]),
  formsController.getLatestFormId,
);

// GET /api/forms/:id - Get a specific form by ID (psas, club-officer, school-admin, mis, and participants assigned to form)
router.get(
  "/:id",
  requireRole([
    "psas",
    "club-officer",
    "senior-management",
    "mis",
    "student",
    "evaluator",
    "guest-speaker",
  ]),
  formsController.getFormById,
);

// POST /api/forms/blank - Create a new blank form (psas, club-officer can create)
router.post(
  "/blank",
  requireRole(["psas", "club-officer"]),
  formsController.createBlankForm,
);

// PATCH /api/forms/:id/draft - Autosave/update an existing draft form
router.patch(
  "/:id/draft",
  requireRole(["psas", "club-officer"]),
  formsController.updateDraftForm,
);

// POST /api/forms/upload - Upload a file and create a form from it (psas, club-officer can create)
router.post(
  "/upload",
  requireRole(["psas", "club-officer"]),
  formsController.uploadForm,
);

// POST /api/forms/extract-by-url - Extract data from Google Forms URL (all roles can extract for analysis)
router.post(
  "/extract-by-url",
  requireRole(["psas", "club-officer", "senior-management", "mis"]),
  formsController.extractFormByUrl,
);

// POST /api/forms/extract-by-file - Extract questions from a file (all roles can extract for analysis)
router.post(
  "/extract-by-file",
  requireRole(["psas", "club-officer", "senior-management", "mis"]),
  formsController.extractFormByFile,
);

// POST /api/forms/upload-by-url - Upload a Google Forms URL and create a form from it (psas, club-officer can create)
router.post(
  "/upload-by-url",
  requireRole(["psas", "club-officer"]),
  formsController.uploadFormByUrl,
);

// PATCH /api/forms/:id/publish - Publish a form and generate shareable link (psas, club-officer can publish)
router.patch(
  "/:id/publish",
  requireRole(["psas", "club-officer"]),
  formsController.publishForm,
);

// PATCH /api/forms/:id/reopen - Reopen a closed form (psas, club-officer can reopen)
router.patch(
  "/:id/reopen",
  requireRole(["psas", "club-officer"]),
  formsController.reopenForm,
);

// DELETE /api/forms/:id - Delete a form (only psas can delete)
router.delete("/:id", requireRole(["psas"]), formsController.deleteForm);

// POST /api/forms/:id/submit - Submit responses to a form (participants and club-officers can submit)
router.post(
  "/:id/submit",
  requireRole(["student", "club-officer", "evaluator", "guest-speaker"]),
  formsController.submitFormResponse,
);

// GET /api/forms/:id/responses - Get responses for a form (psas, school-admin, mis can view; creator can view their own)
router.get(
  "/:id/responses",
  requireRole(["psas", "senior-management", "mis"]),
  formsController.getFormResponses,
);

// POST /api/forms/:id/attendees - Upload attendee list for a form (psas, club-officer can upload)
router.post(
  "/:id/attendees",
  requireRole(["psas", "club-officer"]),
  formsController.uploadAttendeeList,
);

// POST /api/forms/:id/attendees-json - Update attendee list with JSON data (psas, club-officer can update)
router.post(
  "/:id/attendees-json",
  requireRole(["psas", "club-officer"]),
  formsController.updateAttendeeListJson,
);

// GET /api/forms/:id/attendees - Get attendee list for a form (psas, club-officer can view)
router.get(
  "/:id/attendees",
  requireRole(["psas", "club-officer"]),
  formsController.getAttendeeList,
);

// GET /api/forms/test-debug - Test endpoint to verify debugging is working
router.get("/test-debug", (req, res) => {
  console.log(
    "🧪 DEBUG TEST: Server is running updated code with debugging enabled",
  );
  console.log("Current timestamp:", new Date().toISOString());
  return formsController.testDebugging(req, res);
});

module.exports = router;
