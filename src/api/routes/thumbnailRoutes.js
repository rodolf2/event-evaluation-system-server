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

  // Extract ID from filename (format: form-{id}.png or certificate-{id}.png)
  const match = filename.match(/^(form|certificate)-([a-zA-Z0-9]+)\.png$/);

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
