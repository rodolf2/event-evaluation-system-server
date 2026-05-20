const express = require("express");
const router = express.Router();
const Form = require("../../models/Form");
const Certificate = require("../../models/Certificate");
const thumbnailService = require("../../services/thumbnail/thumbnailService");
const { requireAuth } = require("../../middlewares/auth");

/**
 * Helper: send a PNG buffer or SVG string as an HTTP response with caching headers.
 */
function sendImage(res, result) {
  res.set("Cache-Control", "public, max-age=300"); // 5 minutes
  
  if (result && result.type === "svg") {
    res.set("Content-Type", "image/svg+xml");
    return res.send(result.content);
  }
  
  let buffer = result;
  if (result && result.type === "png") {
    buffer = result.content;
  }
  
  if (buffer && Buffer.isBuffer(buffer)) {
    res.set("Content-Type", "image/png");
    return res.send(buffer);
  }
  
  return null;
}

/**
 * Helper: redirect to a placehold.co placeholder when thumbnail generation fails.
 */
function sendPlaceholder(res, text = "Report", colors = "1e3a8a/ffffff") {
  const encoded = encodeURIComponent(text);
  return res.redirect(`https://placehold.co/800x450/${colors}?text=${encoded}`);
}

router.get("/:filename", requireAuth, async (req, res) => {
  const filename = req.params.filename;

  // Security check to prevent directory traversal
  // Allow alphanumeric, dashes, and .png extension only
  if (!filename.match(/^[a-zA-Z0-9-]+\.png$/)) {
    return res.status(400).send("Invalid filename");
  }

  // ── Handle default-report.png fallback ─────────────────────────────────────
  if (filename === "default-report.png") {
    try {
      const result = await thumbnailService.generateReportThumbnail("Event Evaluation Report");
      if (result) return sendImage(res, result);
    } catch (error) {
      console.error("Error generating default-report thumbnail:", error);
    }
    return sendPlaceholder(res, "Event Evaluation Report");
  }

  // ── MIS static thumbnails ──────────────────────────────────────────────────
  if (filename === "user-stats.png" || filename === "system-health.png") {
    if (req.user.role !== "mis") {
      return res.status(403).send("Access denied");
    }

    try {
      let buffer;
      if (filename === "user-stats.png") {
        buffer = await thumbnailService.generateMisThumbnail("user-stats", {
          title: "User Statistics",
          icon: "📊",
          subtitle: "View user analytics and trends",
        });
      } else {
        buffer = await thumbnailService.generateMisThumbnail("system-health", {
          title: "System Health",
          icon: "🖥️",
          subtitle: "Monitor system performance",
        });
      }

      if (buffer) return sendImage(res, buffer);
    } catch (error) {
      console.error(`Error generating MIS thumbnail ${filename}:`, error);
    }

    return sendPlaceholder(res, filename.replace(".png", ""), "4B5563/ffffff");
  }

  // ── Extract type and ID from filename ─────────────────────────────────────
  // Supported formats: form-{id}.png | certificate-{id}.png | analytics-{id}.png
  const match = filename.match(/^(form|certificate|analytics)-([a-zA-Z0-9]+)\.png$/);

  if (!match) {
    return res.status(404).send("Thumbnail not found");
  }

  const [, type, id] = match;

  try {
    // ── Form report thumbnail ────────────────────────────────────────────────
    if (type === "form") {
      const userId = req.user._id;
      const userEmail = req.user.email ? req.user.email.toLowerCase().trim() : "";
      const userRole = req.user.role;

      let form = await Form.findOne({ _id: id, createdBy: userId }).select("title");

      if (!form && userRole === "participant") {
        form = await Form.findOne({
          _id: id,
          status: "published",
          "attendeeList.email": userEmail,
        }).select("title");
      }

      if (
        !form &&
        [
          "psas",
          "club-officer",
          "school-admin",
          "senior-management",
          "club-adviser",
          "mis",
          "evaluator",
          "guest-speaker",
          "speaker",
          "guest",
          "guest-speaker",
        ].includes(userRole)
      ) {
        form = await Form.findById(id).select("title");
      }

      if (!form) {
        console.log(`Access denied: User ${userId} (${userRole}) cannot access form ${id}`);
        return res.status(403).send("Access denied");
      }

      console.log(`Generating report thumbnail for form ${id}: ${form.title} (role: ${userRole})`);
      const buffer = await thumbnailService.generateReportThumbnail(form.title);

      if (buffer) return sendImage(res, buffer);
      return sendPlaceholder(res, form.title || "Report");
    }

    // ── Analytics thumbnail ──────────────────────────────────────────────────
    if (type === "analytics") {
      const userId = req.user._id;
      const userEmail = req.user.email ? req.user.email.toLowerCase().trim() : "";
      const userRole = req.user.role;

      let form = await Form.findOne({ _id: id, createdBy: userId }).select(
        "title attendeeList responses"
      );

      if (!form && userRole === "participant") {
        form = await Form.findOne({
          _id: id,
          status: "published",
          "attendeeList.email": userEmail,
        }).select("title attendeeList responses");
      }

      if (
        !form &&
        [
          "psas",
          "club-officer",
          "school-admin",
          "senior-management",
          "club-adviser",
          "mis",
          "evaluator",
          "guest-speaker",
          "speaker",
          "guest",
          "guest-speaker",
        ].includes(userRole)
      ) {
        form = await Form.findById(id).select("title attendeeList responses");
      }

      if (!form) {
        console.log(`Access denied: User ${userId} (${userRole}) cannot access analytics for form ${id}`);
        return res.status(403).send("Access denied");
      }

      // Calculate analytics data
      const totalAttendees = form.attendeeList ? form.attendeeList.length : 0;
      const totalResponses = form.responses ? form.responses.length : 0;
      const responseRate =
        totalAttendees > 0
          ? Math.round((totalResponses / totalAttendees) * 100 * 100) / 100
          : 0;
      const respondedAttendees = form.attendeeList
        ? form.attendeeList.filter((a) => a.hasResponded).length
        : 0;
      const remainingNonResponses = totalAttendees - respondedAttendees;

      let sentimentBreakdown = {
        positive: { percentage: 0, count: 0 },
        neutral: { percentage: 0, count: 0 },
        negative: { percentage: 0, count: 0 },
      };

      if (totalResponses > 0 && form.responses && form.responses.length > 0) {
        let positiveCount = 0;
        let neutralCount = 0;
        let negativeCount = 0;

        form.responses.forEach((response) => {
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

      console.log(`Generating analytics thumbnail for form ${id}: ${form.title}`);
      const buffer = await thumbnailService.generateAnalyticsThumbnail(thumbnailData);

      if (buffer) return sendImage(res, buffer);
      return sendPlaceholder(res, "Analytics", "3B82F6/ffffff");
    }

    // ── Certificate thumbnail ────────────────────────────────────────────────
    if (type === "certificate") {
      const userId = req.user._id;
      const userRole = req.user.role;

      let certificate;

      if (
        [
          "psas",
          "club-officer",
          "school-admin",
          "senior-management",
          "club-adviser",
          "mis",
          "evaluator",
          "guest-speaker",
          "speaker",
          "guest",
          "guest-speaker",
        ].includes(userRole)
      ) {
        certificate = await Certificate.findById(id)
          .populate("userId", "name")
          .select("userId certificateType");
      } else {
        certificate = await Certificate.findOne({ _id: id, userId })
          .populate("userId", "name")
          .select("userId certificateType");
      }

      if (!certificate) {
        console.log(`Access denied: User ${userId} (${userRole}) cannot access certificate ${id}`);
        return res.status(403).send("Access denied");
      }

      const userName = certificate.userId?.name || "Participant";
      const certType = certificate.certificateType || "participation";

      console.log(`Generating certificate thumbnail for ${id}: ${userName}`);
      const buffer = await thumbnailService.generateCertificateThumbnail(userName, certType);

      if (buffer) return sendImage(res, buffer);
      return sendPlaceholder(res, userName, "d4a855/5a4a1f");
    }
  } catch (error) {
    console.error(`Error generating thumbnail for ${filename}:`, error);
    return sendPlaceholder(res, "Error");
  }

  return res.status(404).send("Thumbnail not found");
});

module.exports = router;
