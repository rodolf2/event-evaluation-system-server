const { createCanvas, loadImage, registerFont } = require("canvas");
const path = require("path");
const fs = require("fs").promises;

class ThumbnailService {
  constructor() {
    this.width = 800;
    this.height = 450;
    this.thumbnailDir = path.join(__dirname, "../../../public/thumbnails");
  }

  async ensureThumbnailDirectory() {
    try {
      await fs.mkdir(this.thumbnailDir, { recursive: true });
    } catch (error) {
      console.error("Error creating thumbnail directory:", error);
    }
  }

  async generateReportThumbnail(formId, formTitle, force = false) {
    try {
      const thumbnailPath = path.join(this.thumbnailDir, `form-${formId}.png`);

      // Check if thumbnail exists
      if (!force) {
        try {
          await fs.access(thumbnailPath);
          // If file exists, return path immediately
          return `/api/thumbnails/form-${formId}.png`;
        } catch (err) {
          // File doesn't exist, proceed to generate
        }
      }

      await this.ensureThumbnailDirectory();

      const canvas = createCanvas(this.width, this.height);
      const ctx = canvas.getContext("2d");

      // Background
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, this.width, this.height);

      // Header - Navy blue background
      ctx.fillStyle = "#1e3a8a";
      ctx.fillRect(0, 0, this.width, 100);

      // Gold accent stripes
      ctx.fillStyle = "#f59e0b";
      const stripeWidth = 60;
      ctx.beginPath();
      ctx.moveTo(this.width - stripeWidth, 0);
      ctx.lineTo(this.width, 0);
      ctx.lineTo(this.width, 100);
      ctx.lineTo(this.width - stripeWidth + 20, 100);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(stripeWidth, 0);
      ctx.lineTo(stripeWidth + 20, 100);
      ctx.lineTo(0, 100);
      ctx.closePath();
      ctx.fill();

      // School name
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 24px Arial";
      ctx.textAlign = "left";
      ctx.fillText("LA VERDAD", 140, 40);

      ctx.font = "18px Arial";
      ctx.fillText("CHRISTIAN COLLEGE, INC.", 140, 65);

      ctx.font = "12px Arial";
      ctx.fillText("Apalit, Pampanga", 140, 85);

      // Main title - Dynamic (e.g., "Sample Event Evaluation Report")
      ctx.fillStyle = "#000000";
      ctx.font = "bold 42px Arial";
      ctx.textAlign = "center";

      // Wrap title text if too long
      const maxTitleWidth = 750;
      const words = formTitle.split(" ");
      let currentLine = "";
      let lines = [];

      words.forEach((word) => {
        const testLine = currentLine + (currentLine ? " " : "") + word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxTitleWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      });

      if (currentLine) {
        lines.push(currentLine);
      }

      // Draw title lines centered
      const titleY = 180;
      const lineHeight = 50;
      lines.forEach((line, index) => {
        ctx.fillText(line, this.width / 2, titleY + index * lineHeight);
      });

      // Underline after title
      const underlineY = titleY + lines.length * lineHeight + 20;
      ctx.strokeStyle = "#D8D8D8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(50, underlineY);
      ctx.lineTo(this.width - 50, underlineY);
      ctx.stroke();

      // Description text
      ctx.font = "14px Arial";
      ctx.fillStyle = "#000000";
      ctx.textAlign = "center";

      const descriptionY = underlineY + 30;
      const description1 =
        "This evaluation report serves as a guide for the institution to acknowledge the impact of the said event";
      const description2 =
        "on the welfare and enjoyment of the students at La Verdad Christian College - Apalit, Pampanga.";

      ctx.fillText(description1, this.width / 2, descriptionY);
      ctx.fillText(description2, this.width / 2, descriptionY + 20);

      // Event name section (in uppercase, bold)
      const eventSectionY = descriptionY + 70;
      ctx.font = "bold 16px Arial";
      ctx.fillStyle = "#000000";
      ctx.textAlign = "center";

      // Create uppercase version of the title for this section
      const eventNameUpper = formTitle.toUpperCase();
      ctx.fillText(eventNameUpper, this.width / 2, eventSectionY);

      // "EVALUATION RESULT" text
      ctx.font = "bold 18px Arial";
      ctx.fillText("EVALUATION RESULT", this.width / 2, eventSectionY + 30);

      // "College Level" text
      ctx.font = "16px Arial";
      ctx.fillText("College Level", this.width / 2, eventSectionY + 55);

      // Save thumbnail
      const buffer = canvas.toBuffer("image/png");
      await fs.writeFile(thumbnailPath, buffer);

      // Verify file size
      const stats = await fs.stat(thumbnailPath);
      if (stats.size === 0) {
        await fs.unlink(thumbnailPath);
        throw new Error("Generated thumbnail is 0 bytes");
      }

      console.log(`✅ Generated thumbnail for form ${formId}: ${formTitle}`);
      return `/api/thumbnails/form-${formId}.png`;
    } catch (error) {
      console.error(
        `❌ Error generating thumbnail for form ${formId}:`,
        error.message
      );
      console.error(`Stack trace:`, error.stack);
      // Return a dynamic placeholder
      const encodedTitle = encodeURIComponent(formTitle || "Report");
      return `https://placehold.co/800x450/1e3a8a/ffffff?text=${encodedTitle}`;
    }
  }

  async getThumbnailPath(formId) {
    const thumbnailPath = path.join(this.thumbnailDir, `form-${formId}.png`);

    try {
      await fs.access(thumbnailPath);
      return `/api/thumbnails/form-${formId}.png`;
    } catch {
      return `https://placehold.co/800x450/1e3a8a/ffffff?text=Report`;
    }
  }

  async deleteThumbnail(formId) {
    try {
      const thumbnailPath = path.join(this.thumbnailDir, `form-${formId}.png`);
      await fs.unlink(thumbnailPath);
      console.log(`Deleted thumbnail for form ${formId}`);
    } catch (error) {
      console.error(`Error deleting thumbnail for form ${formId}:`, error);
    }
  }
}

module.exports = new ThumbnailService();
