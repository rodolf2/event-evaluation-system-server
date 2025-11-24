const SharedReport = require("../../models/SharedReport");

// Share report with school administrators
exports.shareReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { schoolAdmins } = req.body;
    const sharedBy = req.user._id; // From auth middleware

    if (
      !schoolAdmins ||
      !Array.isArray(schoolAdmins) ||
      schoolAdmins.length === 0
    ) {
      return res.status(400).json({
        message:
          "Please provide at least one school administrator to share with",
      });
    }

    // Check if already shared with these admins, if so update
    let sharedReport = await SharedReport.findOne({ reportId });

    if (sharedReport) {
      // Update existing shared report
      sharedReport.sharedWith = schoolAdmins;
      sharedReport.sharedBy = sharedBy;
      sharedReport.sharedAt = new Date();
      await sharedReport.save();
    } else {
      // Create new shared report
      sharedReport = await SharedReport.create({
        reportId,
        eventId: reportId, // Using reportId as eventId for now
        sharedWith: schoolAdmins,
        sharedBy,
      });
    }

    res.status(200).json({
      message: `Report shared with ${schoolAdmins.length} school administrator(s)`,
      sharedReport,
    });
  } catch (error) {
    console.error("Error sharing report:", error);
    res.status(500).json({
      message: "Failed to share report",
      error: error.message,
    });
  }
};

// Get reports shared with the logged-in user (for school-admin dashboard)
exports.getSharedReports = async (req, res) => {
  try {
    const userEmail = req.user.email;

    // Find all reports shared with this user's email
    const sharedReports = await SharedReport.find({
      "sharedWith.email": userEmail,
    }).populate("sharedBy", "name email");

    res.status(200).json({
      reports: sharedReports,
    });
  } catch (error) {
    console.error("Error fetching shared reports:", error);
    res.status(500).json({
      message: "Failed to fetch shared reports",
      error: error.message,
    });
  }
};

// Get who a specific report is shared with (for PSAS)
exports.getReportSharing = async (req, res) => {
  try {
    const { reportId } = req.params;

    const sharedReport = await SharedReport.findOne({ reportId }).populate(
      "sharedBy",
      "name email"
    );

    if (!sharedReport) {
      return res.status(404).json({
        message: "This report has not been shared yet",
      });
    }

    res.status(200).json({
      sharedReport,
    });
  } catch (error) {
    console.error("Error fetching report sharing info:", error);
    res.status(500).json({
      message: "Failed to fetch report sharing info",
      error: error.message,
    });
  }
};
