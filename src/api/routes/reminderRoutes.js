const express = require("express");
const router = express.Router();
const {
  getReminders,
  createReminder,
  deleteReminder,
} = require("../controllers/reminderController");
const { requireAuth } = require("../../middlewares/auth");

// All reminder routes require a logged in user
router.use(requireAuth);

// GET /api/reminders - Get all reminders for the logged-in user
router.get("/", getReminders);

// POST /api/reminders - Create new reminder
router.post("/", createReminder);

// DELETE /api/reminders/:id - Delete a reminder
router.delete("/:id", deleteReminder);

module.exports = router;
