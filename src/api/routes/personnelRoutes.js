const express = require("express");
const router = express.Router();
const Personnel = require("../../models/Personnel");

// GET /api/personnel - Get all personnel with optional filters
router.get("/", async (req, res) => {
  try {
    const {
      search,
      department,
      limit = 500,
      sortBy = "name",
      sortOrder = "asc",
    } = req.query;

    let query = { isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { position: { $regex: search, $options: "i" } },
      ];
    }

    if (department) {
      query.department = department;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const personnel = await Personnel.find(query)
      .sort(sortOptions)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: { personnel },
    });
  } catch (error) {
    console.error("Error fetching personnel:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch personnel",
      error: error.message,
    });
  }
});

// POST /api/personnel - Create new personnel
router.post("/", async (req, res) => {
  try {
    const { name, email, department, position } = req.body;

    if (!name || !email || !department || !position) {
      return res.status(400).json({
        success: false,
        message: "Name, email, department, and position are required",
      });
    }

    const existing = await Personnel.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Personnel with this email already exists",
      });
    }

    const personnel = new Personnel({
      name,
      email: email.toLowerCase(),
      department,
      position,
    });

    await personnel.save();

    res.status(201).json({
      success: true,
      data: { personnel },
    });
  } catch (error) {
    console.error("Error creating personnel:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create personnel",
      error: error.message,
    });
  }
});

// PUT /api/personnel/:id - Update personnel
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, department, position } = req.body;

    const personnel = await Personnel.findById(id);
    if (!personnel) {
      return res.status(404).json({
        success: false,
        message: "Personnel not found",
      });
    }

    if (name) personnel.name = name;
    if (email) personnel.email = email.toLowerCase();
    if (department) personnel.department = department;
    if (position) personnel.position = position;

    await personnel.save();

    res.json({
      success: true,
      data: { personnel },
    });
  } catch (error) {
    console.error("Error updating personnel:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update personnel",
      error: error.message,
    });
  }
});

// DELETE /api/personnel/:id - Delete personnel
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const personnel = await Personnel.findByIdAndDelete(id);
    if (!personnel) {
      return res.status(404).json({
        success: false,
        message: "Personnel not found",
      });
    }

    res.json({
      success: true,
      message: "Personnel deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting personnel:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete personnel",
      error: error.message,
    });
  }
});

module.exports = router;
