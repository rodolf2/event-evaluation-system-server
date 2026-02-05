const SharedReport = require("../../models/SharedReport");
const SystemSettings = require("../../models/SystemSettings");
const User = require("../../models/User");
const Notification = require("../../models/Notification");
const puppeteer = require("puppeteer");
const { sendEmail, resendClient } = require("../../utils/email");
console.log("[REPORTS-CONTROLLER-DEBUG] Imported email utils:", { 
  sendEmailType: typeof sendEmail, 
  resendClientExists: !!resendClient 
});
const {
  generateSharedReportEmailHtml,
} = require("../../utils/sharedReportEmailTemplate");

// Get school admins and senior management for report sharing (accessible by PSAS/Club Officers)
exports.getSchoolAdmins = async (req, res) => {
  try {
    // Prevent caching to ensure role switching updates the list
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    
    const userRole = req.user.role;
    console.log(`[getSchoolAdmins] Fetching potential share recipients for user: ${req.user.email} (${userRole})`);
    let query = {};

    // Define filtering logic based on requester's role
    if (userRole === "psas") {
      // PSAS can share with Senior Management and MIS Head
      query = {
        $or: [
          { role: "senior-management", isActive: true },
          { role: "mis", position: { $regex: /mis head/i }, isActive: true },
        ],
      };
    } else if (userRole === "club-officer") {
      // Club Officers can share with Club Advisers and PSAS Head
      query = {
        $or: [
          { role: "club-adviser", isActive: true },
          { role: "psas", position: { $regex: /psas head/i }, isActive: true },
        ],
      };
    } else {
      // MIS and others see everyone relevant
      query = {
        $or: [
          {
            role: {
              $in: [
                "school-admin",
                "senior-management",
                "club-adviser",
                "psas",
                "club-officer",
                "evaluator",
                "guest-speaker",
              ],
            },
            isActive: true,
          },
          { role: "mis", "permissions.canViewReports": true, isActive: true },
          { role: "mis", position: { $regex: /mis head/i }, isActive: true },
        ],
      };
    }

    console.log(`[getSchoolAdmins] Query constructed:`, JSON.stringify(query));
    
    const users = await User.find(query).select(
      "name email department position role permissions",
    );
    console.log(`[getSchoolAdmins] Found ${users.length} users matching query.`);

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
    const { schoolAdmins, reportTitle, expiresAt } = req.body;
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

    const hasGuest = schoolAdmins.some((admin) =>
      ["evaluator", "guest-speaker"].includes(admin.role),
    );

    let expirationDate = null;

    if (hasGuest) {
      if (!expiresAt) {
        return res.status(400).json({
          message: "Please provide an expiration date for guest access",
        });
      }

      expirationDate = new Date(expiresAt);
      const now = new Date();
      const minExpiration = new Date(now);
      minExpiration.setMonth(now.getMonth() + 6);
      const maxExpiration = new Date(now);
      maxExpiration.setFullYear(now.getFullYear() + 1);

      if (expirationDate < minExpiration || expirationDate > maxExpiration) {
        return res.status(400).json({
          message:
            "Guest expiration must be between 6 months and 1 year from now",
        });
      }
    } else if (expiresAt) {
      // If expiresAt is provided even for staff, we can use it, but it's not mandatory
      expirationDate = new Date(expiresAt);
    }

    // Check if already shared with these admins, if so update
    let sharedReport = await SharedReport.findOne({ reportId });

    if (sharedReport) {
      // Update existing shared report
      sharedReport.sharedWith = schoolAdmins;
      sharedReport.sharedBy = sharedBy;
      sharedReport.sharedAt = new Date();
      sharedReport.expiresAt = expirationDate;
      await sharedReport.save();
    } else {
      // Create new shared report
      sharedReport = await SharedReport.create({
        reportId,
        eventId: reportId, // Using reportId as eventId for now
        sharedWith: schoolAdmins,
        sharedBy,
        expiresAt: expirationDate,
      });
    }

    // Send email notifications to all recipients
    const frontendUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || "http://localhost:5173";
    console.log(`[shareReport] Preparing to send emails to ${schoolAdmins.length} recipients...`);
    
    // Check if Resend client is available
    if (resendClient) {
      console.log("[shareReport] Using Resend client directly based on configuration.");
    } else {
      console.log("[shareReport] Resend client not found, falling back to sendEmail helper (might be SMTP/Gmail).");
    }

    const emailPromises = schoolAdmins.map(async (admin) => {
      try {
        let reportUrlPath = "senior-management";
        if (admin.role === "psas") {
          reportUrlPath = "psas";
        } else if (admin.role === "club-adviser") {
          reportUrlPath = "club-adviser";
        } else if (admin.role === "mis") {
          reportUrlPath = "mis";
        }

        const reportUrl = `${frontendUrl}/${reportUrlPath}/reports/${reportId}`;
        console.log(`[shareReport] Generating email for ${admin.email} with URL: ${reportUrl}`);

        const htmlContent = generateSharedReportEmailHtml({
          recipientName: admin.name || admin.email,
          sharedByName: sharedByUser.name || sharedByUser.email,
          reportTitle: reportTitle || "Evaluation Report",
          reportUrl,
        });

        const subject = `📊 Report Shared: ${reportTitle || "Evaluation Report"}`;



        if (resendClient) {
          // Use Resend Directly
             const { data, error } = await resendClient.emails.send({
              from: "Event Evaluation System <onboarding@resend.dev>", // Default or env var
              to: admin.email,
              subject: subject,
              html: htmlContent,
            });
            if (error) throw new Error(error.message);
            console.log(`[shareReport] ✓ Resend email sent to ${admin.email}. ID: ${data?.id}`);
        } else {
           // Use Helper Fallback
            await sendEmail({
              to: admin.email,
              subject: subject,
              html: htmlContent,
            });
            console.log(`[shareReport] ✓ Helper email sent to ${admin.email}`);
        }

        // Create In-System Notification
        try {
          await Notification.create({
            title: "Report Shared With You",
            message: `${sharedByUser.name || sharedByUser.email} shared a report: "${reportTitle || "Evaluation Report"}"`,
            type: "info",
            priority: "medium",
            targetRoles: [admin.role],
            targetUsers: [admin._id],
            relatedEntity: {
              type: "form", // Or 'report', but schema says 'form'/'event'/'certificate'/'reminder'/'system'
              id: reportId
            },
            createdBy: sharedBy,
            isSystemGenerated: true
          });
          console.log(`[shareReport] ✓ Notification created for ${admin.email}`);
        } catch (notifError) {
          console.error(`[shareReport] ✗ Failed to create notification for ${admin.email}:`, notifError);
          // Don't fail the entire process if notification fails
        }

        return { email: admin.email, success: true };
      } catch (emailError) {
        console.error(`[shareReport] ✗ Failed to send email to ${admin.email}:`, emailError);
        return {
          email: admin.email,
          success: false,
          error: emailError.message,
        };
      }
    });

    const emailResults = await Promise.all(emailPromises);
    const successfulEmails = emailResults.filter((r) => r.success).length;
    console.log(`[shareReport] Email Summary: ${successfulEmails}/${schoolAdmins.length} sent successfully.`);

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
  let browser = null;
  try {
    const { reportId } = req.params;
    const { html, title, headerTemplate, footerTemplate } = req.body;

    if (!html) {
      return res.status(400).json({
        message: "HTML content is required",
      });
    }

    console.log("[PDF Generation] Starting PDF generation...");
    console.log("[PDF Generation] HTML length:", html.length);

    // Launch puppeteer browser
    try {
      if (process.env.RENDER || process.env.NODE_ENV === "production") {
        console.log("[PDF Generation] Using production configuration (@sparticuz/chromium)");
        const chromium = require("@sparticuz/chromium");
        const puppeteerCore = require("puppeteer-core");

        // Optional: Load a custom font if needed, though usually not strictly required for basic English
        // await chromium.font('https://raw.githack.com/googlei18n/noto-emoji/master/fonts/NotoColorEmoji.ttf');

        browser = await puppeteerCore.launch({
          args: chromium.args,
          defaultViewport: chromium.defaultViewport,
          executablePath: await chromium.executablePath(),
          headless: chromium.headless,
          ignoreHTTPSErrors: true,
        });
      } else {
        console.log("[PDF Generation] Using local configuration (puppeteer)");
        browser = await puppeteer.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
      }
      console.log("[PDF Generation] Browser launched successfully");
    } catch (launchError) {
      console.error(
        "[PDF Generation] Failed to launch browser:",
        launchError
      );
      return res.status(500).json({
        message: "Failed to initialize PDF generator",
        error: "Browser launch failed: " + launchError.message,
      });
    }

    const page = await browser.newPage();
    console.log("[PDF Generation] Page created");

    // Use the complete HTML sent from client (already includes styles)
    const fullHTML = html;

    try {
      await page.setContent(fullHTML, {
        waitUntil: "networkidle0",
        timeout: 30000,
      });
      console.log("[PDF Generation] Content set successfully");
    } catch (contentError) {
      console.error(
        "[PDF Generation] Failed to set page content:",
        contentError.message,
      );
      await browser.close();
      return res.status(500).json({
        message: "Failed to process HTML content",
        error: contentError.message,
      });
    }

    // Generate PDF
    try {
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "80px", // Header height only
          right: "15px",
          bottom: "50px", // Footer height only
          left: "15px",
        },
        preferCSSPageSize: false,
        displayHeaderFooter: !!(headerTemplate || footerTemplate),
        headerTemplate: headerTemplate || "<div></div>",
        footerTemplate: footerTemplate || "<div></div>",
      });
      console.log(
        "[PDF Generation] PDF generated successfully, size:",
        pdfBuffer.length,
      );

      await browser.close();

      // Set response headers for file download
      const filename = `evaluation-report-${
        new Date().toISOString().split("T")[0]
      }.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.setHeader("Content-Length", pdfBuffer.length);

      // Send the PDF buffer
      res.send(pdfBuffer);
      console.log("[PDF Generation] PDF sent to client successfully");
    } catch (pdfError) {
      console.error(
        "[PDF Generation] Failed to generate PDF:",
        pdfError.message,
      );
      await browser.close();
      return res.status(500).json({
        message: "Failed to generate PDF",
        error: pdfError.message,
      });
    }
  } catch (error) {
    console.error("[PDF Generation] Unexpected error:", error);
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error(
          "[PDF Generation] Error closing browser:",
          closeError.message,
        );
      }
    }
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
    const Report = require("../../models/Report");

    // Check for MIS special access
    const isMis = req.user.role === "mis";
    const isHead = req.user.position === "MIS Head";

    let reportsToDisplay = [];

    if (isMis) {
      const settings = await SystemSettings.findOne();
      const enableMisReports = settings?.generalSettings?.enableMisReports;

      if (enableMisReports) {
        // Find ALL available reports
        const allReports = await Report.find({
          status: { $in: ["published", "active"] },
        }).sort({ createdAt: -1 });

        // Merge with shared info if any
        reportsToDisplay = await Promise.all(
          allReports.map(async (report) => {
            const form = await Form.findById(report.formId).select(
              "title description eventName status createdAt updatedAt",
            );

            // Check if it was specifically shared to get sharedBy info
            const sharedInfo = await SharedReport.findOne({
              reportId: report.formId,
            });

            return {
              id: report.formId,
              formId: report.formId,
              title: report.title || form?.title || form?.eventName || "Report",
              description: form?.description || "",
              thumbnail: report.thumbnail || null,
              status: report.status || "published",
              sharedBy: sharedInfo?.sharedBy || null,
              sharedAt: sharedInfo?.sharedAt || report.createdAt,
              eventDate: report.eventDate || form?.createdAt,
              lastUpdated: report.updatedAt || form?.updatedAt,
              isShared: !!sharedInfo,
            };
          }),
        );
      } else {
        // Fallback to only specifically shared reports
        const sharedReports = await SharedReport.find({
          "sharedWith.email": userEmail,
          $or: [
            { expiresAt: null },
            { expiresAt: { $exists: false } },
            { expiresAt: { $gt: new Date() } },
          ],
        }).populate("sharedBy", "name email");

        reportsToDisplay = await Promise.all(
          sharedReports.map(async (sharedReport) => {
            const form = await Form.findById(sharedReport.reportId).select(
              "title description eventName status createdAt updatedAt",
            );

            const report = await Report.findOne({
              formId: sharedReport.reportId,
            }).select("thumbnail title status eventDate updatedAt");

            return {
              id: sharedReport.reportId,
              formId: sharedReport.reportId,
              title:
                report?.title ||
                form?.title ||
                form?.eventName ||
                "Shared Report",
              description: form?.description || "",
              thumbnail: report?.thumbnail || null,
              status: report?.status || "shared",
              sharedBy: sharedReport.sharedBy,
              sharedAt: sharedReport.sharedAt,
              eventDate: report?.eventDate || form?.createdAt,
              lastUpdated: report?.updatedAt || form?.updatedAt,
              isShared: true,
            };
          }),
        );
      }
    } else {
      // Logic for non-MIS users (School Admins, etc.)
      const sharedReports = await SharedReport.find({
        "sharedWith.email": userEmail,
        $or: [
          { expiresAt: null },
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } },
        ],
      }).populate("sharedBy", "name email");

      reportsToDisplay = await Promise.all(
        sharedReports.map(async (sharedReport) => {
          const form = await Form.findById(sharedReport.reportId).select(
            "title description eventName status createdAt updatedAt",
          );

          const report = await Report.findOne({
            formId: sharedReport.reportId,
          }).select("thumbnail title status eventDate updatedAt");

          return {
            id: sharedReport.reportId,
            formId: sharedReport.reportId,
            title:
              report?.title ||
              form?.title ||
              form?.eventName ||
              "Shared Report",
            description: form?.description || "",
            thumbnail: report?.thumbnail || null,
            status: report?.status || "shared",
            sharedBy: sharedReport.sharedBy,
            sharedAt: sharedReport.sharedAt,
            eventDate: report?.eventDate || form?.createdAt,
            lastUpdated: report?.updatedAt || form?.updatedAt,
            isShared: true,
          };
        }),
      );
    }

    // Filter out any reports where the form was not found
    const validReports = reportsToDisplay.filter((r) => r.title);

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
