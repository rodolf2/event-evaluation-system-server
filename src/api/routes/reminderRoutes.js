const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../../middlewares/auth");
const reminderService = require("../../services/reminder/reminderService");
const Reminder = require("../../models/Reminder");

// GET /api/reminders - Get all reminders for the authenticated user
// All authenticated users (any role) can view their own reminders
router.get("/", requireAuth, async (req, res) => {
  try {
    const reminders = await Reminder.find({ userId: req.user._id }).sort({
      date: 1,
      createdAt: -1,
    });

    res.status(200).json(reminders);
  } catch (error) {
    console.error("Error fetching reminders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reminders",
      error: error.message,
    });
  }
});

// GET /api/reminders/:id - Get a single reminder by ID
// All authenticated users (any role) can view their own reminders
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const reminder = await Reminder.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: "Reminder not found",
      });
    }

    res.status(200).json({
      success: true,
      data: reminder,
    });
  } catch (error) {
    console.error("Error fetching reminder:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reminder",
      error: error.message,
    });
  }
});

// POST /api/reminders - Create a new reminder
// All authenticated users (any role) can create their own reminders
router.post("/", requireAuth, async (req, res) => {
  try {
    const { title, date, description, priority } = req.body;

    if (!title || !date) {
      return res.status(400).json({
        success: false,
        message: "Title and date are required",
      });
    }

    const reminderData = {
      title,
      date: new Date(date),
      description: description || "",
      priority: priority || "medium",
      userId: req.user._id,
    };

    const newReminder = await reminderService.createReminder(reminderData);

    res.status(201).json({
      success: true,
      message: "Reminder created successfully and email sent",
      data: newReminder,
    });
  } catch (error) {
    console.error("Error creating reminder:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create reminder",
      error: error.message,
    });
  }
});

// PUT /api/reminders/:id - Update a reminder
// All authenticated users (any role) can update only their own reminders
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, date, description, priority } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (date !== undefined) updateData.date = new Date(date);
    if (description !== undefined) updateData.description = description;
    if (priority !== undefined) updateData.priority = priority;

    const reminder = await reminderService.updateReminder(
      id,
      req.user._id,
      updateData,
    );

    res.status(200).json({
      success: true,
      message: "Reminder updated successfully",
      data: reminder,
    });
  } catch (error) {
    console.error("Error updating reminder:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update reminder",
      error: error.message,
    });
  }
});

// DELETE /api/reminders/:id - Delete a reminder
// All authenticated users (any role) can delete only their own reminders
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const reminder = await Reminder.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: "Reminder not found",
      });
    }

    await Reminder.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Reminder deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting reminder:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete reminder",
      error: error.message,
    });
  }
});

// PUT /api/reminders/:id/complete - Mark a reminder as completed
// All authenticated users (any role) can complete only their own reminders
router.put("/:id/complete", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const reminder = await reminderService.completeReminder(id, req.user._id);

    res.status(200).json({
      success: true,
      message: "Reminder marked as completed successfully",
      data: reminder,
    });
  } catch (error) {
    console.error("Error completing reminder:", error);
    res.status(500).json({
      success: false,
      message: "Failed to complete reminder",
      error: error.message,
    });
  }
});

module.exports = router;
