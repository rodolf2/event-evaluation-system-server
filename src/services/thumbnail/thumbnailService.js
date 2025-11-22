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

  async generateAnalyticsThumbnail(formId, analyticsData = {}, force = false) {
    try {
      const thumbnailPath = path.join(
        this.thumbnailDir,
        `analytics-${formId}.png`
      );

      // Check if thumbnail exists
      if (!force) {
        try {
          await fs.access(thumbnailPath);
          // If file exists, return path immediately
          return `/api/thumbnails/analytics-${formId}.png`;
        } catch (err) {
          // File doesn't exist, proceed to generate
        }
      }

      await this.ensureThumbnailDirectory();

      const canvas = createCanvas(this.width, this.height);
      const ctx = canvas.getContext("2d");

      // Light background with subtle gradient
      const bgGradient = ctx.createLinearGradient(0, 0, 0, this.height);
      bgGradient.addColorStop(0, "#F8FAFC");
      bgGradient.addColorStop(1, "#F1F5F9");
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, this.width, this.height);

      // Get analytics data with defaults
      const {
        totalAttendees = 0,
        totalResponses = 0,
        responseRate = 0,
        remainingNonResponses = 0,
        responseBreakdown = {
          positive: { percentage: 0, count: 0 },
          neutral: { percentage: 0, count: 0 },
          negative: { percentage: 0, count: 0 },
        },
      } = analyticsData;

      // Container with white background and rounded corners
      const containerPadding = 30;
      const containerRadius = 20;
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.roundRect(
        containerPadding,
        containerPadding,
        this.width - containerPadding * 2,
        this.height - containerPadding * 2,
        containerRadius
      );
      ctx.fill();

      // Add subtle shadow effect
      ctx.shadowColor = "rgba(0, 0, 0, 0.1)";
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(
        containerPadding,
        containerPadding,
        this.width - containerPadding * 2,
        this.height - containerPadding * 2
      );
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;

      // Stats cards at the top
      const cardWidth = 200;
      const cardHeight = 80;
      const cardSpacing = 20;
      const cardStartX = (this.width - (cardWidth * 3 + cardSpacing * 2)) / 2;
      const cardStartY = 60;

      // Card 1: Total Event Attendees (Blue gradient)
      const card1X = cardStartX;
      const card1Y = cardStartY;

      const gradient1 = ctx.createLinearGradient(
        card1X,
        card1Y,
        card1X,
        card1Y + cardHeight
      );
      gradient1.addColorStop(0, "#1E40AF");
      gradient1.addColorStop(1, "#1E3A8A");
      ctx.fillStyle = gradient1;
      ctx.beginPath();
      ctx.roundRect(card1X, card1Y, cardWidth, cardHeight, 10);
      ctx.fill();

      // Card 1 icon and text
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "10px Arial";
      ctx.textAlign = "left";
      ctx.fillText("👥 Total Event Attendees", card1X + 15, card1Y + 25);
      ctx.font = "bold 32px Arial";
      ctx.fillText(totalAttendees.toString(), card1X + 15, card1Y + 60);

      // Card 2: Total Responses (Light background)
      const card2X = cardStartX + cardWidth + cardSpacing;
      const card2Y = cardStartY;

      ctx.fillStyle = "#F8FAFC";
      ctx.strokeStyle = "#E2E8F0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(card2X, card2Y, cardWidth, cardHeight, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#1E3A8A";
      ctx.font = "10px Arial";
      ctx.textAlign = "left";
      ctx.fillText("📊 Total Responses", card2X + 15, card2Y + 25);
      ctx.font = "bold 32px Arial";
      ctx.fillText(totalResponses.toString(), card2X + 15, card2Y + 60);

      // Card 3: Remaining Non-Responses (Blue gradient)
      const card3X = cardStartX + (cardWidth + cardSpacing) * 2;
      const card3Y = cardStartY;

      const gradient3 = ctx.createLinearGradient(
        card3X,
        card3Y,
        card3X,
        card3Y + cardHeight
      );
      gradient3.addColorStop(0, "#1E40AF");
      gradient3.addColorStop(1, "#1E3A8A");
      ctx.fillStyle = gradient3;
      ctx.beginPath();
      ctx.roundRect(card3X, card3Y, cardWidth, cardHeight, 10);
      ctx.fill();

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "10px Arial";
      ctx.textAlign = "left";
      ctx.fillText("📋 Remaining Non-Responses", card3X + 15, card3Y + 25);
      ctx.font = "bold 32px Arial";
      ctx.fillText(remainingNonResponses.toString(), card3X + 15, card3Y + 60);

      // Charts section
      const chartsY = cardStartY + cardHeight + 40;

      // LEFT: Response Rate Gauge Chart
      const gaugeX = this.width * 0.3;
      const gaugeY = chartsY + 80;
      const gaugeRadius = 70;
      const gaugeWidth = 20;

      // Gauge background (gray arc)
      ctx.strokeStyle = "#E5E7EB";
      ctx.lineWidth = gaugeWidth;
      ctx.beginPath();
      ctx.arc(gaugeX, gaugeY, gaugeRadius, Math.PI, 2 * Math.PI);
      ctx.stroke();

      // Gauge foreground (blue arc for response rate)
      const gaugeAngle = Math.PI + (responseRate / 100) * Math.PI;
      ctx.strokeStyle = "#1E40AF";
      ctx.lineWidth = gaugeWidth;
      ctx.beginPath();
      ctx.arc(gaugeX, gaugeY, gaugeRadius, Math.PI, gaugeAngle);
      ctx.stroke();

      // Response rate percentage text
      ctx.fillStyle = "#1E3A8A";
      ctx.font = "bold 36px Arial";
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(responseRate)}%`, gaugeX, gaugeY - 10);

      // Label below gauge
      ctx.fillStyle = "#64748B";
      ctx.font = "14px Arial";
      ctx.fillText("Response Rate", gaugeX, gaugeY + 50);

      // RIGHT: Response Breakdown Donut Chart
      const donutX = this.width * 0.7;
      const donutY = chartsY + 60;
      const donutOuterRadius = 60;
      const donutInnerRadius = 35;

      // Calculate total for proper percentages
      const total =
        responseBreakdown.positive.count +
        responseBreakdown.neutral.count +
        responseBreakdown.negative.count;

      if (total > 0) {
        let currentAngle = -Math.PI / 2; // Start at top

        // Positive segment (dark blue)
        const positiveAngle =
          (responseBreakdown.positive.count / total) * 2 * Math.PI;
        ctx.fillStyle = "#1E3A8A";
        ctx.beginPath();
        ctx.arc(
          donutX,
          donutY,
          donutOuterRadius,
          currentAngle,
          currentAngle + positiveAngle
        );
        ctx.arc(
          donutX,
          donutY,
          donutInnerRadius,
          currentAngle + positiveAngle,
          currentAngle,
          true
        );
        ctx.closePath();
        ctx.fill();
        currentAngle += positiveAngle;

        // Neutral segment (medium blue)
        const neutralAngle =
          (responseBreakdown.neutral.count / total) * 2 * Math.PI;
        ctx.fillStyle = "#3B82F6";
        ctx.beginPath();
        ctx.arc(
          donutX,
          donutY,
          donutOuterRadius,
          currentAngle,
          currentAngle + neutralAngle
        );
        ctx.arc(
          donutX,
          donutY,
          donutInnerRadius,
          currentAngle + neutralAngle,
          currentAngle,
          true
        );
        ctx.closePath();
        ctx.fill();
        currentAngle += neutralAngle;

        // Negative segment (light blue)
        const negativeAngle =
          (responseBreakdown.negative.count / total) * 2 * Math.PI;
        ctx.fillStyle = "#93C5FD";
        ctx.beginPath();
        ctx.arc(
          donutX,
          donutY,
          donutOuterRadius,
          currentAngle,
          currentAngle + negativeAngle
        );
        ctx.arc(
          donutX,
          donutY,
          donutInnerRadius,
          currentAngle + negativeAngle,
          currentAngle,
          true
        );
        ctx.closePath();
        ctx.fill();
      } else {
        // Empty state - gray donut
        ctx.fillStyle = "#E5E7EB";
        ctx.beginPath();
        ctx.arc(donutX, donutY, donutOuterRadius, 0, 2 * Math.PI);
        ctx.arc(donutX, donutY, donutInnerRadius, 2 * Math.PI, 0, true);
        ctx.closePath();
        ctx.fill();
      }

      // Donut legend
      const legendX = donutX - 100;
      const legendY = donutY + donutOuterRadius + 30;
      const legendSpacing = 25;

      ctx.textAlign = "left";
      ctx.font = "12px Arial";

      // Positive legend
      ctx.fillStyle = "#1E3A8A";
      ctx.fillRect(legendX, legendY, 12, 12);
      ctx.fillStyle = "#1E3A8A";
      ctx.fillText(
        `Positive    ${responseBreakdown.positive.count} (${responseBreakdown.positive.percentage}%)`,
        legendX + 20,
        legendY + 10
      );

      // Neutral legend
      ctx.fillStyle = "#3B82F6";
      ctx.fillRect(legendX, legendY + legendSpacing, 12, 12);
      ctx.fillStyle = "#3B82F6";
      ctx.fillText(
        `Neutral     ${responseBreakdown.neutral.count} (${responseBreakdown.neutral.percentage}%)`,
        legendX + 20,
        legendY + legendSpacing + 10
      );

      // Negative legend
      ctx.fillStyle = "#93C5FD";
      ctx.fillRect(legendX, legendY + legendSpacing * 2, 12, 12);
      ctx.fillStyle = "#93C5FD";
      ctx.fillText(
        `Negative    ${responseBreakdown.negative.count} (${responseBreakdown.negative.percentage}%)`,
        legendX + 20,
        legendY + legendSpacing * 2 + 10
      );

      // Response Breakdown title above donut
      ctx.fillStyle = "#1E3A8A";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Response Breakdown", donutX, chartsY + 20);

      // Bottom title
      ctx.fillStyle = "#3B82F6";
      ctx.font = "bold 24px Arial";
      ctx.textAlign = "center";
      ctx.fillText("View Event Analytics", this.width / 2, this.height - 40);

      // Save thumbnail
      const buffer = canvas.toBuffer("image/png");
      await fs.writeFile(thumbnailPath, buffer);

      // Verify file size
      const stats = await fs.stat(thumbnailPath);
      if (stats.size === 0) {
        await fs.unlink(thumbnailPath);
        throw new Error("Generated analytics thumbnail is 0 bytes");
      }

      console.log(`✅ Generated analytics thumbnail for form ${formId}`);
      return `/api/thumbnails/analytics-${formId}.png`;
    } catch (error) {
      console.error(
        `❌ Error generating analytics thumbnail for form ${formId}:`,
        error.message
      );
      console.error(`Stack trace:`, error.stack);
      // Return a placeholder
      return `https://placehold.co/800x450/3B82F6/ffffff?text=Analytics`;
    }
  }

  async generateCertificateThumbnail(
    certificateId,
    userName,
    certificateType = "participation"
  ) {
    try {
      const thumbnailPath = path.join(
        this.thumbnailDir,
        `certificate-${certificateId}.png`
      );

      // Check if thumbnail exists
      try {
        await fs.access(thumbnailPath);
        // If file exists, return path immediately
        return `/api/thumbnails/certificate-${certificateId}.png`;
      } catch (err) {
        // File doesn't exist, proceed to generate
      }

      await this.ensureThumbnailDirectory();

      const canvas = createCanvas(this.width, this.height);
      const ctx = canvas.getContext("2d");

      // Gradient background (gold/elegant theme)
      const gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
      gradient.addColorStop(0, "#f4e4c1");
      gradient.addColorStop(1, "#e5c896");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.width, this.height);

      // Decorative border
      ctx.strokeStyle = "#8b6914";
      ctx.lineWidth = 8;
      ctx.strokeRect(20, 20, this.width - 40, this.height - 40);

      // Inner border
      ctx.strokeStyle = "#d4a855";
      ctx.lineWidth = 2;
      ctx.strokeRect(30, 30, this.width - 60, this.height - 60);

      // Certificate header
      ctx.fillStyle = "#5a4a1f";
      ctx.font = "bold 48px Arial";
      ctx.textAlign = "center";
      ctx.fillText("CERTIFICATE", this.width / 2, 100);

      // Certificate type
      ctx.font = "24px Arial";
      ctx.fillText(
        `of ${
          certificateType.charAt(0).toUpperCase() + certificateType.slice(1)
        }`,
        this.width / 2,
        140
      );

      // Decorative line
      ctx.strokeStyle = "#8b6914";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.width / 2 - 150, 160);
      ctx.lineTo(this.width / 2 + 150, 160);
      ctx.stroke();

      // "This is to certify that"
      ctx.fillStyle = "#3a3a3a";
      ctx.font = "italic 20px Arial";
      ctx.fillText("This is to certify that", this.width / 2, 210);

      // Recipient name
      ctx.fillStyle = "#1a1a1a";
      ctx.font = "bold 36px Arial";
      const displayName = userName || "Participant";
      ctx.fillText(displayName, this.width / 2, 260);

      // Underline for name
      const nameWidth = ctx.measureText(displayName).width;
      ctx.strokeStyle = "#8b6914";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.width / 2 - nameWidth / 2, 270);
      ctx.lineTo(this.width / 2 + nameWidth / 2, 270);
      ctx.stroke();

      // Certificate description
      ctx.fillStyle = "#3a3a3a";
      ctx.font = "20px Arial";
      ctx.fillText(
        "has successfully completed the requirements",
        this.width / 2,
        310
      );
      ctx.fillText(
        "and is hereby recognized for their achievement",
        this.width / 2,
        340
      );

      // Date section
      ctx.font = "16px Arial";
      ctx.fillStyle = "#5a5a5a";
      const currentDate = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      ctx.fillText(`Date: ${currentDate}`, this.width / 2, 390);

      // Save thumbnail
      const buffer = canvas.toBuffer("image/png");
      await fs.writeFile(thumbnailPath, buffer);

      // Verify file size
      const stats = await fs.stat(thumbnailPath);
      if (stats.size === 0) {
        await fs.unlink(thumbnailPath);
        throw new Error("Generated certificate thumbnail is 0 bytes");
      }

      console.log(
        `✅ Generated certificate thumbnail for ${certificateId}: ${userName}`
      );
      return `/api/thumbnails/certificate-${certificateId}.png`;
    } catch (error) {
      console.error(
        `❌ Error generating certificate thumbnail for ${certificateId}:`,
        error.message
      );
      console.error(`Stack trace:`, error.stack);
      // Return a placeholder
      const encodedName = encodeURIComponent(userName || "Certificate");
      return `https://placehold.co/800x450/d4a855/5a4a1f?text=${encodedName}`;
    }
  }
}

module.exports = new ThumbnailService();
