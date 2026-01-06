const SharedReport = require("../../models/SharedReport");
const puppeteer = require("puppeteer");

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

// Generate PDF report
exports.generatePDFReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { html, title, headerTemplate, footerTemplate } = req.body;

    if (!html) {
      return res.status(400).json({
        message: "HTML content is required",
      });
    }

    // Launch puppeteer browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // Use the complete HTML sent from client (already includes styles)
    const fullHTML = html;

    await page.setContent(fullHTML, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "220px", // Space for header - increased to prevent overlap
        right: "20px",
        bottom: "60px", // Space for footer template
        left: "20px",
      },
      preferCSSPageSize: false,
      displayHeaderFooter: !!(headerTemplate || footerTemplate),
      headerTemplate: headerTemplate || "<div></div>",
      footerTemplate: footerTemplate || "<div></div>",
    });

    await browser.close();

    // Set response headers for file download
    const filename = `evaluation-report-${
      new Date().toISOString().split("T")[0]
    }.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);

    // Send the PDF buffer
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating PDF report:", error);
    res.status(500).json({
      message: "Failed to generate PDF report",
      error: error.message,
    });
  }
};

// Get reports shared with the logged-in user (for school-admin dashboard)
exports.getSharedReports = async (req, res) => {
  try {
    const userEmail = req.user.email;
    const Form = require("../../models/Form");

    // Find all reports shared with this user's email
    const sharedReports = await SharedReport.find({
      "sharedWith.email": userEmail,
    }).populate("sharedBy", "name email");

    // Fetch the actual form/report data for each shared report
    const reportsWithDetails = await Promise.all(
      sharedReports.map(async (sharedReport) => {
        const form = await Form.findById(sharedReport.reportId).select(
          "title description eventName thumbnail status createdAt updatedAt"
        );

        return {
          id: sharedReport.reportId,
          formId: sharedReport.reportId,
          title: form?.title || form?.eventName || "Shared Report",
          description: form?.description || "",
          thumbnail: form?.thumbnail || null,
          status: form?.status || "shared",
          sharedBy: sharedReport.sharedBy,
          sharedAt: sharedReport.sharedAt,
          eventDate: form?.createdAt,
          lastUpdated: form?.updatedAt,
          isShared: true,
        };
      })
    );

    // Filter out any reports where the form was not found
    const validReports = reportsWithDetails.filter((r) => r.title);

    res.status(200).json({
      success: true,
      reports: validReports,
    });
  } catch (error) {
    console.error("Error fetching shared reports:", error);
    res.status(500).json({
      success: false,
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
