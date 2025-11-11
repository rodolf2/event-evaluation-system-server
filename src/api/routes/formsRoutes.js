const express = require("express");
const router = express.Router();
const { requireRole } = require("../../middlewares/auth");
const formsController = require("../controllers/formsController");

// GET /api/forms - Get all forms (psas, club-officer, school-admin, mis can access)
router.get(
  "/",
  requireRole(["psas", "club-officer", "school-admin", "mis"]),
  formsController.getAllForms
);

// GET /api/forms/my-evaluations - Get forms that the current user is assigned to (participants, club-officers)
router.get(
  "/my-evaluations",
  requireRole(["participant", "club-officer"]),
  formsController.getMyEvaluations
);

// GET /api/forms/:id - Get a specific form by ID (psas, club-officer, school-admin, mis, and participants assigned to form)
router.get(
  "/:id",
  requireRole(["psas", "club-officer", "school-admin", "mis", "participant"]),
  formsController.getFormById
);

 // POST /api/forms/blank - Create a new blank form (psas, club-officer can create)
router.post(
  "/blank",
  requireRole(["psas", "club-officer"]),
  formsController.createBlankForm
);

// PATCH /api/forms/:id/draft - Autosave/update an existing draft form
router.patch(
  "/:id/draft",
  requireRole(["psas", "club-officer"]),
  formsController.updateDraftForm
);

// POST /api/forms/upload - Upload a file and create a form from it (psas, club-officer can create)
router.post(
  "/upload",
  requireRole(["psas", "club-officer"]),
  formsController.uploadForm
);

// POST /api/forms/extract-by-url - Extract data from Google Forms URL (all roles can extract for analysis)
router.post(
  "/extract-by-url",
  requireRole(["psas", "club-officer", "school-admin", "mis"]),
  formsController.extractFormByUrl
);

// POST /api/forms/extract-by-file - Extract questions from a file (all roles can extract for analysis)
router.post(
  "/extract-by-file",
  requireRole(["psas", "club-officer", "school-admin", "mis"]),
  formsController.extractFormByFile
);

// POST /api/forms/upload-by-url - Upload a Google Forms URL and create a form from it (psas, club-officer can create)
router.post(
  "/upload-by-url",
  requireRole(["psas", "club-officer"]),
  formsController.uploadFormByUrl
);

// PATCH /api/forms/:id/publish - Publish a form and generate shareable link (psas, club-officer can publish)
router.patch(
  "/:id/publish",
  requireRole(["psas", "club-officer"]),
  formsController.publishForm
);

// DELETE /api/forms/:id - Delete a form (only psas can delete)
router.delete("/:id", requireRole(["psas"]), formsController.deleteForm);

// POST /api/forms/:id/submit - Submit responses to a form (only participants can submit)
router.post(
  "/:id/submit",
  requireRole(["participant"]),
  formsController.submitFormResponse
);

// GET /api/forms/:id/responses - Get responses for a form (psas, school-admin, mis can view; creator can view their own)
router.get(
  "/:id/responses",
  requireRole(["psas", "school-admin", "mis"]),
  formsController.getFormResponses
);

module.exports = router;
