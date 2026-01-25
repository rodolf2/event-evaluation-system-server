const SharedReport = require("../../models/SharedReport");
const User = require("../../models/User");
const puppeteer = require("puppeteer");
const sendEmail = require("../../utils/email");
const {
  generateSharedReportEmailHtml,
} = require("../../utils/sharedReportEmailTemplate");

// Get school admins and senior management for report sharing (accessible by PSAS/Club Officers)
exports.getSchoolAdmins = async (req, res) => {
  try {
    // Return users with school-admin, senior-management roles, or MIS with canViewReports permission
    const users = await User.find({
      $or: [
        {
          role: { $in: ["school-admin", "senior-management"] },
          isActive: true,
        },
        { role: "mis", "permissions.canViewReports": true, isActive: true },
      ],
    }).select("name email department position role permissions");

    res.status(200).json({
      success: true,
      users: users.map((u) => ({
        id: u._id,
        _id: u._id,
        name: u.name || u.email,
        email: u.email,
        department: u.department || "",
        position: u.position || u.role,
        role: u.role,
      })),
    });
  } catch (error) {
    console.error("Error fetching school admins:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch school administrators",
      error: error.message,
    });
  }
};
// Share report with school administrators
exports.shareReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { schoolAdmins, reportTitle } = req.body;
    const sharedBy = req.user._id; // From auth middleware
    const sharedByUser = req.user;

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

    // Send email notifications to all recipients
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const emailPromises = schoolAdmins.map(async (admin) => {
      try {
        const reportUrl = `${frontendUrl}/senior-management/reports/${reportId}`;
        const htmlContent = generateSharedReportEmailHtml({
          recipientName: admin.name || admin.email,
          sharedByName: sharedByUser.name || sharedByUser.email,
          reportTitle: reportTitle || "Evaluation Report",
          reportUrl,
        });

        await sendEmail({
          to: admin.email,
          subject: `📊 Report Shared: ${reportTitle || "Evaluation Report"}`,
          html: htmlContent,
        });

        console.log(`Email notification sent to ${admin.email}`);
        return { email: admin.email, success: true };
      } catch (emailError) {
        console.error(`Failed to send email to ${admin.email}:`, emailError);
        return {
          email: admin.email,
          success: false,
          error: emailError.message,
        };
      }
    });

    const emailResults = await Promise.all(emailPromises);
    const successfulEmails = emailResults.filter((r) => r.success).length;

    res.status(200).json({
      message: `Report shared with ${schoolAdmins.length} school administrator(s). ${successfulEmails} email notification(s) sent.`,
      sharedReport,
      emailResults,
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
        top: "250px", // Increased space for header + form title + description
        right: "30px", // Small right margin for better content fit
        bottom: "100px", // Increased space for footer template
        left: "30px", // Small left margin for better content fit
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
          "title description eventName thumbnail status createdAt updatedAt",
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
      }),
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
      "name email",
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
