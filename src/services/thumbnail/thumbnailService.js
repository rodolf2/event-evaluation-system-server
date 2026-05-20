let createCanvas;
try {
  createCanvas = require("canvas").createCanvas;
} catch (e) {
  console.warn("⚠️ Canvas package is not available. Falling back to dynamic SVG generation.");
  createCanvas = null;
}

class ThumbnailService {
  constructor() {
    this.width = 800;
    this.height = 450;
  }

  escapeXml(unsafe) {
    if (typeof unsafe !== "string") return "";
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }

  wrapText(text, maxChars = 35) {
    if (typeof text !== "string") return [];
    const words = text.split(" ");
    let currentLine = "";
    let lines = [];
    words.forEach((word) => {
      const testLine = currentLine + (currentLine ? " " : "") + word;
      if (testLine.length > maxChars && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    if (currentLine) {
      lines.push(currentLine);
    }
    return lines;
  }

  generateReportThumbnailSVG(formTitle) {
    const lines = this.wrapText(formTitle, 35);
    const titleY = 180;
    const lineHeight = 45;
    
    let titleElements = "";
    lines.forEach((line, index) => {
      const y = titleY + index * lineHeight;
      titleElements += `<text x="400" y="${y}" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#000000" text-anchor="middle">${this.escapeXml(line)}</text>`;
    });

    const underlineY = titleY + lines.length * lineHeight + 15;
    const descriptionY = underlineY + 30;
    const eventSectionY = descriptionY + 70;

    const svg = `<svg width="800" height="450" viewBox="0 0 800 450" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .header-text { font-family: Arial, sans-serif; fill: #FFFFFF; }
          .body-text { font-family: Arial, sans-serif; fill: #000000; text-anchor: middle; }
        </style>
      </defs>
      <!-- Background -->
      <rect width="800" height="450" fill="#FFFFFF"/>
      
      <!-- Header -->
      <rect width="800" height="100" fill="#1e3a8a"/>
      
      <!-- Gold Stripes -->
      <path d="M 740 0 L 800 0 L 800 100 L 760 100 Z" fill="#f59e0b"/>
      <path d="M 0 0 L 60 0 L 80 100 L 0 100 Z" fill="#f59e0b"/>
      
      <!-- Header Text -->
      <text x="140" y="40" class="header-text" font-size="24" font-weight="bold">LA VERDAD</text>
      <text x="140" y="65" class="header-text" font-size="18">CHRISTIAN COLLEGE, INC.</text>
      <text x="140" y="85" class="header-text" font-size="12">Apalit, Pampanga</text>
      
      <!-- Title Lines -->
      ${titleElements}
      
      <!-- Underline -->
      <line x1="50" y1="${underlineY}" x2="750" y2="${underlineY}" stroke="#D8D8D8" stroke-width="2"/>
      
      <!-- Description -->
      <text x="400" y="${descriptionY}" class="body-text" font-size="14">This evaluation report serves as a guide for the institution to acknowledge the impact of the said event</text>
      <text x="400" y="${descriptionY + 20}" class="body-text" font-size="14">on the welfare and enjoyment of the students at La Verdad Christian College - Apalit, Pampanga.</text>
      
      <!-- Event Section -->
      <text x="400" y="${eventSectionY}" class="body-text" font-size="16" font-weight="bold">${this.escapeXml(formTitle.toUpperCase())}</text>
      <text x="400" y="${eventSectionY + 30}" class="body-text" font-size="18" font-weight="bold">EVALUATION RESULT</text>
      <text x="400" y="${eventSectionY + 55}" class="body-text" font-size="16">College Level</text>
    </svg>`;
    
    return { type: "svg", content: svg };
  }

  generateAnalyticsThumbnailSVG(analyticsData = {}) {
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

    const posCount = responseBreakdown.positive?.count || 0;
    const neuCount = responseBreakdown.neutral?.count || 0;
    const negCount = responseBreakdown.negative?.count || 0;
    const totalSentiments = posCount + neuCount + negCount;

    const donutCircumference = 298.45;
    let donutSlices = "";

    if (totalSentiments > 0) {
      const posPct = posCount / totalSentiments;
      const neuPct = neuCount / totalSentiments;
      const negPct = negCount / totalSentiments;

      const posDash = posPct * donutCircumference;
      const neuDash = neuPct * donutCircumference;
      const negDash = negPct * donutCircumference;

      const posRot = -90;
      const neuRot = -90 + posPct * 360;
      const negRot = -90 + (posPct + neuPct) * 360;

      donutSlices += `<circle cx="480" cy="285" r="47.5" fill="none" stroke="#1E3A8A" stroke-width="25" stroke-dasharray="${posDash} ${donutCircumference}" transform="rotate(${posRot}, 480, 285)"/>`;
      donutSlices += `<circle cx="480" cy="285" r="47.5" fill="none" stroke="#3B82F6" stroke-width="25" stroke-dasharray="${neuDash} ${donutCircumference}" transform="rotate(${neuRot}, 480, 285)"/>`;
      donutSlices += `<circle cx="480" cy="285" r="47.5" fill="none" stroke="#93C5FD" stroke-width="25" stroke-dasharray="${negDash} ${donutCircumference}" transform="rotate(${negRot}, 480, 285)"/>`;
    } else {
      donutSlices = `<circle cx="480" cy="285" r="47.5" fill="none" stroke="#E5E7EB" stroke-width="25"/>`;
    }

    const gaugeCircumference = 439.82;
    const gaugeHalf = gaugeCircumference / 2;
    const gaugeDash = (responseRate / 100) * gaugeHalf;

    const svg = `<svg width="800" height="450" viewBox="0 0 800 450" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#F1F5F9"/>
          <stop offset="100%" stop-color="#E2E8F0"/>
        </linearGradient>
        <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1E40AF"/>
          <stop offset="100%" stop-color="#1E3A8A"/>
        </linearGradient>
        <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="4" stdDeviation="10" flood-opacity="0.1"/>
        </filter>
      </defs>
      
      <!-- Background -->
      <rect width="800" height="450" fill="url(#bgGradient)"/>
      
      <!-- Container -->
      <rect x="30" y="30" width="740" height="390" rx="20" fill="#FFFFFF" filter="url(#shadow)"/>
      
      <!-- Title -->
      <text x="400" y="65" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#1E3A8A" text-anchor="middle">Evaluation Summary</text>
      
      <!-- Card 1 (Total Event Attendees) -->
      <rect x="50" y="85" width="220" height="90" rx="10" fill="url(#blueGradient)"/>
      <text x="65" y="115" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">Total Event Attendees</text>
      <text x="65" y="155" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#FFFFFF">${totalAttendees}</text>
      
      <!-- Card 2 (Total Responses) -->
      <rect x="290" y="85" width="220" height="90" rx="10" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="2"/>
      <text x="305" y="115" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#1E3A8A">Total Responses</text>
      <text x="305" y="155" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#1E3A8A">${totalResponses}</text>
      
      <!-- Card 3 (Non-Responses) -->
      <rect x="530" y="85" width="220" height="90" rx="10" fill="url(#blueGradient)"/>
      <text x="545" y="115" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#FFFFFF">Non-Responses</text>
      <text x="545" y="155" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#FFFFFF">${remainingNonResponses}</text>
      
      <!-- Left: Response Rate Gauge -->
      <circle cx="240" cy="295" r="70" fill="none" stroke="#E5E7EB" stroke-width="20" stroke-dasharray="${gaugeHalf} ${gaugeCircumference}" transform="rotate(-180, 240, 295)"/>
      <circle cx="240" cy="295" r="70" fill="none" stroke="#1E40AF" stroke-width="20" stroke-dasharray="${gaugeDash} ${gaugeCircumference}" transform="rotate(-180, 240, 295)"/>
      <text x="240" y="285" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#1E3A8A" text-anchor="middle">${Math.round(responseRate)}%</text>
      <text x="240" y="340" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#64748B" text-anchor="middle">Response Rate</text>
      
      <!-- Right: Response Breakdown Donut -->
      <text x="480" y="225" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#1E3A8A" text-anchor="middle">Response Breakdown</text>
      ${donutSlices}
      
      <!-- Donut Legend -->
      <rect x="580" y="240" width="12" height="12" fill="#1E3A8A"/>
      <text x="600" y="251" font-family="Arial, sans-serif" font-size="12" fill="#1E3A8A">Positive: ${posCount}</text>
      
      <rect x="580" y="265" width="12" height="12" fill="#3B82F6"/>
      <text x="600" y="276" font-family="Arial, sans-serif" font-size="12" fill="#3B82F6">Neutral: ${neuCount}</text>
      
      <rect x="580" y="290" width="12" height="12" fill="#93C5FD"/>
      <text x="600" y="301" font-family="Arial, sans-serif" font-size="12" fill="#93C5FD">Negative: ${negCount}</text>
    </svg>`;

    return { type: "svg", content: svg };
  }

  generateCertificateThumbnailSVG(userName, certificateType = "participation") {
    const displayName = userName || "Participant";
    const certTypeStr = certificateType.charAt(0).toUpperCase() + certificateType.slice(1);
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const svg = `<svg width="800" height="450" viewBox="0 0 800 450" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="certBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f4e4c1"/>
          <stop offset="100%" stop-color="#e5c896"/>
        </linearGradient>
      </defs>
      
      <!-- Background -->
      <rect width="800" height="450" fill="url(#certBg)"/>
      
      <!-- Decorative outer border -->
      <rect x="20" y="20" width="760" height="410" fill="none" stroke="#8b6914" stroke-width="8"/>
      
      <!-- Decorative inner border -->
      <rect x="30" y="30" width="740" height="390" fill="none" stroke="#d4a855" stroke-width="2"/>
      
      <!-- Header -->
      <text x="400" y="100" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#5a4a1f" text-anchor="middle">CERTIFICATE</text>
      <text x="400" y="140" font-family="Arial, sans-serif" font-size="24" fill="#5a4a1f" text-anchor="middle">of ${certTypeStr}</text>
      
      <!-- Decorative line -->
      <line x1="250" y1="160" x2="550" y2="160" stroke="#8b6914" stroke-width="2"/>
      
      <!-- "This is to certify that" -->
      <text x="400" y="210" font-family="Arial, sans-serif" font-size="20" font-style="italic" fill="#3a3a3a" text-anchor="middle">This is to certify that</text>
      
      <!-- Recipient name -->
      <text x="400" y="260" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#1a1a1a" text-anchor="middle">${this.escapeXml(displayName)}</text>
      <line x1="200" y1="275" x2="600" y2="275" stroke="#8b6914" stroke-width="2"/>
      
      <!-- Description -->
      <text x="400" y="310" font-family="Arial, sans-serif" font-size="20" fill="#3a3a3a" text-anchor="middle">has successfully completed the requirements</text>
      <text x="400" y="340" font-family="Arial, sans-serif" font-size="20" fill="#3a3a3a" text-anchor="middle">and is hereby recognized for their achievement</text>
      
      <!-- Date -->
      <text x="400" y="390" font-family="Arial, sans-serif" font-size="16" fill="#5a5a5a" text-anchor="middle">Date: ${currentDate}</text>
    </svg>`;

    return { type: "svg", content: svg };
  }

  generateMisThumbnailSVG(type, data = {}) {
    let startColor = "#4B5563";
    let endColor = "#6B7280";
    let ctaText = "View Details →";

    if (type === "user-stats") {
      startColor = "#1E40AF";
      endColor = "#3B82F6";
      ctaText = "View User Analytics →";
    } else if (type === "system-health") {
      startColor = "#059669";
      endColor = "#10B981";
      ctaText = "View System Reports →";
    }

    const icon = data.icon || "📊";
    const title = data.title || "Dashboard";
    const subtitle = data.subtitle || "Click to view details";

    const circles = [
      { cx: 120, cy: 80, r: 40 },
      { cx: 700, cy: 150, r: 60 },
      { cx: 300, cy: 350, r: 30 },
      { cx: 620, cy: 300, r: 50 },
      { cx: 80, cy: 260, r: 45 },
    ];

    let circleElements = "";
    circles.forEach((c) => {
      circleElements += `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" fill="rgba(255, 255, 255, 0.05)"/>`;
    });

    const svg = `<svg width="800" height="450" viewBox="0 0 800 450" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="misBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${startColor}"/>
          <stop offset="100%" stop-color="${endColor}"/>
        </linearGradient>
      </defs>
      
      <!-- Background -->
      <rect width="800" height="450" fill="url(#misBg)"/>
      
      <!-- Decorative Circles -->
      ${circleElements}
      
      <!-- Icon -->
      <text x="400" y="180" font-family="Arial, sans-serif" font-size="120" text-anchor="middle">${icon}</text>
      
      <!-- Title -->
      <text x="400" y="280" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#FFFFFF" text-anchor="middle">${this.escapeXml(title)}</text>
      
      <!-- Subtitle -->
      <text x="400" y="330" font-family="Arial, sans-serif" font-size="24" fill="rgba(255, 255, 255, 0.8)" text-anchor="middle">${this.escapeXml(subtitle)}</text>
      
      <!-- Bottom Bar -->
      <rect x="0" y="390" width="800" height="60" fill="rgba(255, 255, 255, 0.2)"/>
      <text x="400" y="428" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#FFFFFF" text-anchor="middle">${this.escapeXml(ctaText)}</text>
    </svg>`;

    return { type: "svg", content: svg };
  }

  /**
   * Generate a report thumbnail and return it as a PNG Buffer.
   * @param {string} formTitle
   * @returns {Promise<Buffer|null>}
   */
  async generateReportThumbnail(formTitle) {
    if (!formTitle || typeof formTitle !== "string") {
      formTitle = String(formTitle || "Event Evaluation Report");
    }

    if (!createCanvas) {
      return this.generateReportThumbnailSVG(formTitle);
    }

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
        `❌ Canvas error generating report thumbnail for "${formTitle}", falling back to SVG:`,
        error.message
      );
      return this.generateReportThumbnailSVG(formTitle);
    }
  }

  /**
   * Generate an analytics thumbnail and return it as a PNG Buffer.
   * @param {object} analyticsData
   * @returns {Promise<Buffer|null>}
   */
  async generateAnalyticsThumbnail(analyticsData = {}) {
    if (!createCanvas) {
      return this.generateAnalyticsThumbnailSVG(analyticsData);
    }

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
        `❌ Canvas error generating analytics thumbnail, falling back to SVG:`,
        error.message
      );
      return this.generateAnalyticsThumbnailSVG(analyticsData);
    }
  }

  /**
   * Generate a certificate thumbnail and return it as a PNG Buffer.
   * @param {string} userName
   * @param {string} certificateType
   * @returns {Promise<Buffer|null>}
   */
  async generateCertificateThumbnail(userName, certificateType = "participation") {
    if (!createCanvas) {
      return this.generateCertificateThumbnailSVG(userName, certificateType);
    }

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
        `❌ Canvas error generating certificate thumbnail for "${userName}", falling back to SVG:`,
        error.message
      );
      return this.generateCertificateThumbnailSVG(userName, certificateType);
    }
  }

  /**
   * Generate a MIS thumbnail and return it as a PNG Buffer.
   * @param {string} type
   * @param {object} data
   * @returns {Promise<Buffer|null>}
   */
  async generateMisThumbnail(type, data = {}) {
    if (!createCanvas) {
      return this.generateMisThumbnailSVG(type, data);
    }

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
        `❌ Canvas error generating MIS thumbnail "${type}", falling back to SVG:`,
        error.message
      );
      return this.generateMisThumbnailSVG(type, data);
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
