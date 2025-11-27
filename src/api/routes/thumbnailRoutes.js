const express = require("express");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const Form = require("../../models/Form");
const Certificate = require("../../models/Certificate");
const thumbnailService = require("../../services/thumbnail/thumbnailService");
const { requireAuth } = require("../../middlewares/auth");

router.get("/:filename", requireAuth, async (req, res) => {
  const filename = req.params.filename;

  // Security check to prevent directory traversal
  // Allow alphanumeric, dashes, and .png extension
  if (!filename.match(/^[a-zA-Z0-9-]+\.png$/)) {
    return res.status(400).send("Invalid filename");
  }

  // Path to server/public/thumbnails
  const thumbnailPath = path.join(
    __dirname,
    "../../../public/thumbnails",
    filename
  );

  // If thumbnail exists, serve it
  if (fs.existsSync(thumbnailPath)) {
    const stats = fs.statSync(thumbnailPath);
    console.log(`Serving thumbnail: ${filename}, Size: ${stats.size} bytes`);
    return res.sendFile(thumbnailPath);
  }

  // Extract ID from filename (format: form-{id}.png, certificate-{id}.png, or analytics-{id}.png)
  const match = filename.match(
    /^(form|certificate|analytics)-([a-zA-Z0-9]+)\.png$/
  );

  if (match) {
    const [, type, id] = match;

    try {
      if (type === "form") {
        // Check permissions: user must be the creator or have access to the form
        const userId = req.user._id;
        const userEmail = req.user.email ? req.user.email.toLowerCase().trim() : "";
        const userRole = req.user.role;

        let form = await Form.findOne({
          _id: id,
          createdBy: userId,
        }).select("title");

        // If not creator, check if user is assigned to the form (for participants)
        if (!form && userRole === "participant") {
          form = await Form.findOne({
            _id: id,
            status: "published",
            "attendeeList.email": userEmail,
          }).select("title");
        }

        // For admin roles, allow access to all forms
        if (!form && ["psas", "club-officer", "school-admin", "mis"].includes(userRole)) {
          form = await Form.findById(id).select("title");
        }

        if (form) {
          console.log(`Generating thumbnail for form ${id}: ${form.title} (accessed by ${userRole})`);
          await thumbnailService.generateReportThumbnail(id, form.title);

          // Check if it was generated successfully
          if (fs.existsSync(thumbnailPath)) {
            return res.sendFile(thumbnailPath);
          }
        } else {
          console.log(`Access denied: User ${userId} (${userRole}) cannot access form ${id}`);
          return res.status(403).send("Access denied");
        }
      } else if (type === "analytics") {
        // Check permissions: user must have access to the form
        const userId = req.user._id;
        const userEmail = req.user.email ? req.user.email.toLowerCase().trim() : "";
        const userRole = req.user.role;

        let form = await Form.findOne({
          _id: id,
          createdBy: userId,
        }).select("title attendeeList responses");

        // If not creator, check if user is assigned to the form (for participants)
        if (!form && userRole === "participant") {
          form = await Form.findOne({
            _id: id,
            status: "published",
            "attendeeList.email": userEmail,
          }).select("title attendeeList responses");
        }

        // For admin roles, allow access to all forms
        if (!form && ["psas", "club-officer", "school-admin", "mis"].includes(userRole)) {
          form = await Form.findById(id).select("title attendeeList responses");
        }

        if (form) {
          console.log(
            `Generating analytics thumbnail for form ${id}: ${form.title}`
          );

          // Calculate accurate analytics data (same logic as analytics controller)
          const totalAttendees = form.attendeeList
            ? form.attendeeList.length
            : 0;
          const totalResponses = form.responses ? form.responses.length : 0;

          const responseRate =
            totalAttendees > 0
              ? Math.round((totalResponses / totalAttendees) * 100 * 100) / 100
              : 0;

          // Calculate remaining non-responses
          const respondedAttendees = form.attendeeList
            ? form.attendeeList.filter((attendee) => attendee.hasResponded)
                .length
            : 0;
          const remainingNonResponses = totalAttendees - respondedAttendees;

          // Calculate sentiment breakdown from actual responses (simplified for thumbnail)
          let sentimentBreakdown = {
            positive: { percentage: 0, count: 0 },
            neutral: { percentage: 0, count: 0 },
            negative: { percentage: 0, count: 0 },
          };

          if (
            totalResponses > 0 &&
            form.responses &&
            form.responses.length > 0
          ) {
            // Simple sentiment analysis for thumbnail (faster than full analysis)
            let positiveCount = 0;
            let neutralCount = 0;
            let negativeCount = 0;

            form.responses.forEach((response) => {
              // Check for positive/negative keywords in responses
              const text = JSON.stringify(response).toLowerCase();
              if (
                text.includes("good") ||
                text.includes("great") ||
                text.includes("excellent") ||
                text.includes("amazing") ||
                text.includes("love") ||
                text.includes("perfect")
              ) {
                positiveCount++;
              } else if (
                text.includes("bad") ||
                text.includes("poor") ||
                text.includes("terrible") ||
                text.includes("hate") ||
                text.includes("awful") ||
                text.includes("worst")
              ) {
                negativeCount++;
              } else {
                neutralCount++;
              }
            });

            sentimentBreakdown = {
              positive: {
                percentage: Math.round((positiveCount / totalResponses) * 100),
                count: positiveCount,
              },
              neutral: {
                percentage: Math.round((neutralCount / totalResponses) * 100),
                count: neutralCount,
              },
              negative: {
                percentage: Math.round((negativeCount / totalResponses) * 100),
                count: negativeCount,
              },
            };
          }

          const thumbnailData = {
            totalAttendees,
            totalResponses,
            responseRate,
            remainingNonResponses,
            responseBreakdown: sentimentBreakdown,
          };

          console.log(
            `✅ Using accurate analytics data for form ${id}:`,
            thumbnailData
          );

          // Generate thumbnail with accurate data
          await thumbnailService.generateAnalyticsThumbnail(id, thumbnailData);

          if (fs.existsSync(thumbnailPath)) {
            return res.sendFile(thumbnailPath);
          }
        }
      } else if (type === "certificate") {
        // Check permissions: user must own the certificate or be an admin
        const userId = req.user._id;
        const userRole = req.user.role;

        let certificate;

        if (["psas", "club-officer", "school-admin", "mis"].includes(userRole)) {
          // Admins can view all certificates
          certificate = await Certificate.findById(id)
            .populate("userId", "name")
            .select("userId certificateType");
        } else {
          // Regular users can only view their own certificates
          certificate = await Certificate.findOne({
            _id: id,
            userId: userId,
          })
            .populate("userId", "name")
            .select("userId certificateType");
        }

        if (certificate) {
          const userName = certificate.userId?.name || "Participant";
          const certType = certificate.certificateType || "participation";
          console.log(
            `Generating thumbnail for certificate ${id}: ${userName}`
          );
          await thumbnailService.generateCertificateThumbnail(
            id,
            userName,
            certType
          );

          // Check if it was generated successfully
          if (fs.existsSync(thumbnailPath)) {
            return res.sendFile(thumbnailPath);
          }
        } else {
          console.log(`Access denied: User ${userId} (${userRole}) cannot access certificate ${id}`);
          return res.status(403).send("Access denied");
        }
      }
    } catch (error) {
      console.error(`Error generating thumbnail for ${filename}:`, error);
    }
  }

  // Try to serve default.png if specific thumbnail not found
  const defaultPath = path.join(
    __dirname,
    "../../../public/thumbnails/default.png"
  );

  if (fs.existsSync(defaultPath)) {
    return res.sendFile(defaultPath);
  }

  res.status(404).send("Thumbnail not found");
});

module.exports = router;
