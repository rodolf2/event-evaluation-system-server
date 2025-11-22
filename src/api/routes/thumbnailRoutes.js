const express = require("express");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const Form = require("../../models/Form");
const Certificate = require("../../models/Certificate");
const thumbnailService = require("../../services/thumbnail/thumbnailService");

router.get("/:filename", async (req, res) => {
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
        // Try to generate form thumbnail
        const form = await Form.findById(id).select("title");
        if (form) {
          console.log(`Generating thumbnail for form ${id}: ${form.title}`);
          await thumbnailService.generateReportThumbnail(id, form.title);

          // Check if it was generated successfully
          if (fs.existsSync(thumbnailPath)) {
            return res.sendFile(thumbnailPath);
          }
        }
      } else if (type === "analytics") {
        // Get form data directly for accurate analytics
        const form = await Form.findById(id).select(
          "title attendeeList responses"
        );

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
        // Try to generate certificate thumbnail
        const certificate = await Certificate.findById(id)
          .populate("userId", "name")
          .select("userId certificateType");

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
