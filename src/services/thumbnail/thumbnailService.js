const { createCanvas } = require("canvas");

class ThumbnailService {
  constructor() {
    this.width = 800;
    this.height = 450;
  }

  /**
   * Generate a report thumbnail and return it as a PNG Buffer.
   * @param {string} formTitle
   * @returns {Promise<Buffer|null>}
   */
  async generateReportThumbnail(formTitle) {
    try {
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

      // Main title
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

      const eventNameUpper = formTitle.toUpperCase();
      ctx.fillText(eventNameUpper, this.width / 2, eventSectionY);

      // "EVALUATION RESULT" text
      ctx.font = "bold 18px Arial";
      ctx.fillText("EVALUATION RESULT", this.width / 2, eventSectionY + 30);

      // "College Level" text
      ctx.font = "16px Arial";
      ctx.fillText("College Level", this.width / 2, eventSectionY + 55);

      console.log(`✅ Generated report thumbnail buffer for: ${formTitle}`);
      return canvas.toBuffer("image/png");
    } catch (error) {
      console.error(
        `❌ Error generating report thumbnail for "${formTitle}":`,
        error.message
      );
      return null;
    }
  }

  /**
   * Generate an analytics thumbnail and return it as a PNG Buffer.
   * @param {object} analyticsData
   * @returns {Promise<Buffer|null>}
   */
  async generateAnalyticsThumbnail(analyticsData = {}) {
    try {
      const canvas = createCanvas(this.width, this.height);
      const ctx = canvas.getContext("2d");

      // Light background with subtle gradient
      const bgGradient = ctx.createLinearGradient(0, 0, 0, this.height);
      bgGradient.addColorStop(0, "#F1F5F9");
      bgGradient.addColorStop(1, "#E2E8F0");
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

      // Title at the top
      ctx.fillStyle = "#1E3A8A";
      ctx.font = "bold 28px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Evaluation Summary", this.width / 2, 55);

      // Stats cards below title
      const cardWidth = 220;
      const cardHeight = 90;
      const cardSpacing = 20;
      const cardStartX = (this.width - (cardWidth * 3 + cardSpacing * 2)) / 2;
      const cardStartY = 85;

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

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "left";
      ctx.fillText("Total Event Attendees", card1X + 15, card1Y + 30);
      ctx.font = "bold 36px Arial";
      ctx.fillText(totalAttendees.toString(), card1X + 15, card1Y + 70);

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
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "left";
      ctx.fillText("Total Responses", card2X + 15, card2Y + 30);
      ctx.font = "bold 36px Arial";
      ctx.fillText(totalResponses.toString(), card2X + 15, card2Y + 70);

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
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "left";
      ctx.fillText("Non-Responses", card3X + 15, card3Y + 30);
      ctx.font = "bold 36px Arial";
      ctx.fillText(remainingNonResponses.toString(), card3X + 15, card3Y + 70);

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
      ctx.font = "bold 14px Arial";
      ctx.fillText("Response Rate", gaugeX, gaugeY + 45);

      // RIGHT: Response Breakdown Donut Chart
      const donutX = this.width * 0.6;
      const donutY = chartsY + 70;
      const donutOuterRadius = 60;
      const donutInnerRadius = 35;

      const total =
        responseBreakdown.positive.count +
        responseBreakdown.neutral.count +
        responseBreakdown.negative.count;

      if (total > 0) {
        let currentAngle = -Math.PI / 2;

        const positiveAngle =
          (responseBreakdown.positive.count / total) * 2 * Math.PI;
        ctx.fillStyle = "#1E3A8A";
        ctx.beginPath();
        ctx.arc(donutX, donutY, donutOuterRadius, currentAngle, currentAngle + positiveAngle);
        ctx.arc(donutX, donutY, donutInnerRadius, currentAngle + positiveAngle, currentAngle, true);
        ctx.closePath();
        ctx.fill();
        currentAngle += positiveAngle;

        const neutralAngle =
          (responseBreakdown.neutral.count / total) * 2 * Math.PI;
        ctx.fillStyle = "#3B82F6";
        ctx.beginPath();
        ctx.arc(donutX, donutY, donutOuterRadius, currentAngle, currentAngle + neutralAngle);
        ctx.arc(donutX, donutY, donutInnerRadius, currentAngle + neutralAngle, currentAngle, true);
        ctx.closePath();
        ctx.fill();
        currentAngle += neutralAngle;

        const negativeAngle =
          (responseBreakdown.negative.count / total) * 2 * Math.PI;
        ctx.fillStyle = "#93C5FD";
        ctx.beginPath();
        ctx.arc(donutX, donutY, donutOuterRadius, currentAngle, currentAngle + negativeAngle);
        ctx.arc(donutX, donutY, donutInnerRadius, currentAngle + negativeAngle, currentAngle, true);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = "#E5E7EB";
        ctx.beginPath();
        ctx.arc(donutX, donutY, donutOuterRadius, 0, 2 * Math.PI);
        ctx.arc(donutX, donutY, donutInnerRadius, 2 * Math.PI, 0, true);
        ctx.closePath();
        ctx.fill();
      }

      // Donut legend
      const legendX = donutX + donutOuterRadius + 30;
      const legendY = donutY - 25;
      const legendSpacing = 25;

      ctx.textAlign = "left";
      ctx.font = "12px Arial";

      ctx.fillStyle = "#1E3A8A";
      ctx.fillRect(legendX, legendY, 12, 12);
      ctx.fillStyle = "#1E3A8A";
      ctx.fillText(`Positive: ${responseBreakdown.positive.count}`, legendX + 20, legendY + 10);

      ctx.fillStyle = "#3B82F6";
      ctx.fillRect(legendX, legendY + legendSpacing, 12, 12);
      ctx.fillStyle = "#3B82F6";
      ctx.fillText(`Neutral: ${responseBreakdown.neutral.count}`, legendX + 20, legendY + legendSpacing + 10);

      ctx.fillStyle = "#93C5FD";
      ctx.fillRect(legendX, legendY + legendSpacing * 2, 12, 12);
      ctx.fillStyle = "#93C5FD";
      ctx.fillText(`Negative: ${responseBreakdown.negative.count}`, legendX + 20, legendY + legendSpacing * 2 + 10);

      // Response Breakdown title above donut
      ctx.fillStyle = "#1E3A8A";
      ctx.font = "bold 16px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Response Breakdown", donutX, chartsY + 10);

      console.log(`✅ Generated analytics thumbnail buffer`);
      return canvas.toBuffer("image/png");
    } catch (error) {
      console.error(
        `❌ Error generating analytics thumbnail:`,
        error.message
      );
      return null;
    }
  }

  /**
   * Generate a certificate thumbnail and return it as a PNG Buffer.
   * @param {string} userName
   * @param {string} certificateType
   * @returns {Promise<Buffer|null>}
   */
  async generateCertificateThumbnail(userName, certificateType = "participation") {
    try {
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
        `of ${certificateType.charAt(0).toUpperCase() + certificateType.slice(1)}`,
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
      ctx.fillText("has successfully completed the requirements", this.width / 2, 310);
      ctx.fillText("and is hereby recognized for their achievement", this.width / 2, 340);

      // Date section
      ctx.font = "16px Arial";
      ctx.fillStyle = "#5a5a5a";
      const currentDate = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      ctx.fillText(`Date: ${currentDate}`, this.width / 2, 390);

      console.log(`✅ Generated certificate thumbnail buffer for: ${userName}`);
      return canvas.toBuffer("image/png");
    } catch (error) {
      console.error(
        `❌ Error generating certificate thumbnail for "${userName}":`,
        error.message
      );
      return null;
    }
  }

  /**
   * Generate a MIS thumbnail and return it as a PNG Buffer.
   * @param {string} type
   * @param {object} data
   * @returns {Promise<Buffer|null>}
   */
  async generateMisThumbnail(type, data = {}) {
    try {
      const canvas = createCanvas(this.width, this.height);
      const ctx = canvas.getContext("2d");

      // Create gradient background based on type
      let gradient;
      if (type === "user-stats") {
        gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
        gradient.addColorStop(0, "#1E40AF");
        gradient.addColorStop(1, "#3B82F6");
      } else if (type === "system-health") {
        gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
        gradient.addColorStop(0, "#059669");
        gradient.addColorStop(1, "#10B981");
      } else {
        gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
        gradient.addColorStop(0, "#4B5563");
        gradient.addColorStop(1, "#6B7280");
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.width, this.height);

      // Add subtle pattern overlay
      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
      for (let i = 0; i < 20; i++) {
        const x = Math.random() * this.width;
        const y = Math.random() * this.height;
        const radius = Math.random() * 50 + 20;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Large icon
      ctx.font = "120px Arial";
      ctx.textAlign = "center";
      ctx.fillText(data.icon || "📊", this.width / 2, 180);

      // Title
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 48px Arial";
      ctx.textAlign = "center";
      ctx.fillText(data.title || "Dashboard", this.width / 2, 280);

      // Subtitle
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.font = "24px Arial";
      ctx.fillText(data.subtitle || "Click to view details", this.width / 2, 330);

      // Decorative bottom bar
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      ctx.fillRect(0, this.height - 60, this.width, 60);

      // Call to action text
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 20px Arial";
      if (type === "user-stats") {
        ctx.fillText("View User Analytics →", this.width / 2, this.height - 22);
      } else if (type === "system-health") {
        ctx.fillText("View System Reports →", this.width / 2, this.height - 22);
      } else {
        ctx.fillText("View Details →", this.width / 2, this.height - 22);
      }

      console.log(`✅ Generated MIS thumbnail buffer: ${type}`);
      return canvas.toBuffer("image/png");
    } catch (error) {
      console.error(
        `❌ Error generating MIS thumbnail "${type}":`,
        error.message
      );
      return null;
    }
  }

  /**
   * @deprecated No-op kept for backward compatibility.
   * Thumbnails are now generated in-memory on each request.
   */
  async deleteThumbnail(formId) {
    console.log(`[thumbnailService] deleteThumbnail called for ${formId} — no-op (in-memory mode)`);
  }

  /**
   * @deprecated Returns a placehold.co fallback URL.
   * Thumbnails are now generated in-memory on each request via the route.
   */
  async getThumbnailPath(formId) {
    return `https://placehold.co/800x450/1e3a8a/ffffff?text=Report`;
  }
}

module.exports = new ThumbnailService();
