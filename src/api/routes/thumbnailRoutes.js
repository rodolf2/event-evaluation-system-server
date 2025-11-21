const express = require("express");
const path = require("path");
const fs = require("fs");
const router = express.Router();

router.get("/:filename", (req, res) => {
  const filename = req.params.filename;
  // Path to server/public/thumbnails
  // server/src/api/routes -> ../../../public/thumbnails
  const thumbnailPath = path.join(
    __dirname,
    "../../../public/thumbnails",
    filename
  );

  // Security check to prevent directory traversal
  // Allow alphanumeric, dashes, and .png extension
  if (!filename.match(/^[a-zA-Z0-9-]+\.png$/)) {
    return res.status(400).send("Invalid filename");
  }

  if (fs.existsSync(thumbnailPath)) {
    const stats = fs.statSync(thumbnailPath);
    console.log(`Serving thumbnail: ${filename}, Size: ${stats.size} bytes`);
    res.sendFile(thumbnailPath);
  } else {
    // Try to serve default.png if specific thumbnail not found
    const defaultPath = path.join(
      __dirname,
      "../../../public/thumbnails/default.png"
    );
    if (fs.existsSync(defaultPath)) {
      res.sendFile(defaultPath);
    } else {
      res.status(404).send("Thumbnail not found");
    }
  }
});

module.exports = router;
