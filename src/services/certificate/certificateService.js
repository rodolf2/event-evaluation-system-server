const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const Certificate = require("../../models/Certificate");

const { createCanvas, loadImage } = require("canvas");

class CertificateService {
  validateCertificatePath(basePath, filePath) {
    if (!filePath) throw new Error("Invalid certificate path");

    // Normalize the paths
    const normalizedBase = path.resolve(basePath);
    const normalizedPath = path.resolve(
      normalizedBase,
      path.normalize(filePath)
    );

    // Ensure the path is within the certificates directory
    if (!normalizedPath.startsWith(normalizedBase)) {
      throw new Error("Invalid certificate path detected");
    }

    return normalizedPath;
  }

  constructor() {
    // Create uploads directory if it doesn't exist
    this.certificatesDir = path.join(__dirname, "../../uploads/certificates");
    if (!fs.existsSync(this.certificatesDir)) {
      fs.mkdirSync(this.certificatesDir, { recursive: true });
    }

    // Configure nodemailer transporter
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  generateCertificateId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `CERT-${timestamp}-${random}`;
  }

  async generateCertificatePDF(certificateData) {
    const {
      user,
      event,
      certificateType,
      customMessage,
      certificateId,
      studentName,
      formCustomizations,
    } = certificateData;

    return new Promise((resolve, reject) => {
      try {
        // Use student name from CSV data if provided, otherwise use user name
        const displayName = studentName || user.name || "Participant";
        // Sanitize filename
        const fileName = `${certificateId}_${displayName.replace(
          /[^a-zA-Z0-9]/g,
          "_"
        )}.pdf`; // ✅ added variable
        const safeFileName = fileName;

        // Resolve and validate path
        const filePath = path.resolve(this.certificatesDir, safeFileName);
        if (!filePath.startsWith(path.resolve(this.certificatesDir))) {
          throw new Error("Invalid certificate path detected");
        }

        const doc = new PDFDocument({
          size: "A4",
          layout: "landscape",
          margin: 40,
        });

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        this.drawCertificateBackground(doc, formCustomizations);
        this.drawCertificateContent(doc, {
          userName: studentName || user.name || "Participant",
          eventName: event.name,
          eventDate: event.date,
          certificateType,
          customMessage,
          certificateId,
          issuedDate: new Date(),
          formCustomizations,
        });

        doc.end();

        stream.on("finish", () => {
          resolve({
            filePath,
            fileName, // ✅ fixed undefined variable
          });
        });

        stream.on("error", (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  drawCertificateBackground(doc, formCustomizations = null) {
    const width = doc.page.width;
    const height = doc.page.height;

    // Use custom colors if provided, otherwise use defaults
    const primaryColor = formCustomizations?.primaryColor || "#0f3b66";
    const secondaryColor = formCustomizations?.secondaryColor || "#c89d28";

    doc.save();
    doc.rect(0, 0, width, height).fill("#FFFFFF");
    doc.restore();

    doc.save();
    doc
      .moveTo(0, 0)
      .lineTo(width, 0)
      .lineTo(width, 110)
      .bezierCurveTo(width * 0.72, 150, width * 0.28, 60, 0, 110)
      .closePath();
    doc.fillColor(primaryColor).fill();
    doc.restore();

    doc.save();
    doc
      .moveTo(0, 40)
      .lineTo(width, 0)
      .lineTo(width, 80)
      .bezierCurveTo(width * 0.7, 120, width * 0.3, 40, 0, 80)
      .closePath();
    doc.fillColor("#e9c779").fill(); // Keep gold accent
    doc.restore();

    doc.save();
    doc
      .moveTo(0, height)
      .lineTo(width, height)
      .lineTo(width, height - 110)
      .bezierCurveTo(
        width * 0.72,
        height - 150,
        width * 0.28,
        height - 60,
        0,
        height - 110
      )
      .closePath();
    doc.fillColor(primaryColor).fill();
    doc.restore();

    doc.save();
    doc
      .moveTo(0, height - 40)
      .lineTo(width, height)
      .lineTo(width, height - 80)
      .bezierCurveTo(
        width * 0.7,
        height - 120,
        width * 0.3,
        height - 40,
        0,
        height - 80
      )
      .closePath();
    doc.fillColor("#ecd6a3").fill(); // Keep light gold accent
    doc.restore();

    doc.save();
    doc.lineWidth(3);
    doc.strokeColor(secondaryColor);
    const inset = 28;
    doc.rect(inset, inset, width - inset * 2, height - inset * 2).stroke();
    doc.restore();

    this.drawGoldSeal(doc, 70, 80, secondaryColor);
  }

  drawGoldSeal(doc, x, y, secondaryColor = "#f0b83a") {
    const shadow = "#c17b06";
    const outer = secondaryColor;
    const inner = "#f8d67a";
    const centerHighlight = "#fff6d9";

    doc.save();
    doc.circle(x + 3, y + 3, 36).fill(shadow);
    doc.circle(x, y, 36).fill(outer);
    doc.circle(x - 4, y - 4, 26).fill(inner);
    doc.circle(x - 4, y - 4, 8).fill(outer);

    doc
      .moveTo(x - 18, y + 34)
      .lineTo(x - 6, y + 70)
      .lineTo(x + 6, y + 34)
      .closePath();
    doc.fillColor("#d6a638").fill();

    doc
      .moveTo(x + 6, y + 34)
      .lineTo(x + 18, y + 70)
      .lineTo(x + 30, y + 34)
      .closePath();
    doc.fillColor("#d6a638").fill();

    doc.translate(x - 4, y - 4);
    doc.strokeColor(outer).lineWidth(1.2);
    for (let i = 0; i < 8; i++) {
      doc.rotate((Math.PI * 2) / 8);
      doc.moveTo(14, 0).lineTo(20, 0).stroke();
    }
    doc.restore();
  }

  drawCertificateContent(doc, data) {
    const {
      userName,
      eventName,
      eventDate,
      certificateType,
      customMessage,
      certificateId,
      issuedDate,
      formCustomizations,
    } = data;

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const centerX = pageWidth / 2;

    doc.save();

    // Use custom title and subtitle if provided
    const customTitle = formCustomizations?.customTitle || "CERTIFICATE";
    const customSubtitle = formCustomizations?.customSubtitle || "OF PARTICIPATION";
    const primaryColor = formCustomizations?.primaryColor || "#0f3b66";

    doc.font("Helvetica-Bold").fontSize(36).fillColor(primaryColor);
    doc.text(customTitle, 0, 120, { align: "center", width: pageWidth });
    doc.font("Helvetica").fontSize(18).fillColor(primaryColor);
    doc.text(customSubtitle, 0, 160, {
      align: "center",
      width: pageWidth,
      characterSpacing: 1.2,
    });

    doc.font("Helvetica").fontSize(15).fillColor("#374151");
    doc.text("This certificate is proudly presented to", 0, 220, {
      align: "center",
      width: pageWidth,
    });

    const nameText = (userName || "Participant Name").toUpperCase();
    doc.font("Helvetica-Bold").fontSize(34).fillColor("#c89d28");
    const nameY = 270;
    doc.text(nameText, 0, nameY, { align: "center", width: pageWidth });

    const nameWidth = doc.widthOfString(nameText);
    const underlineX = centerX - nameWidth / 2;
    const underlineY = nameY + doc.currentLineHeight() + 6;
    doc.save();
    doc
      .moveTo(underlineX, underlineY)
      .lineTo(underlineX + nameWidth, underlineY)
      .lineWidth(1)
      .strokeColor("#000000")
      .stroke();
    doc.restore();

    const paraY = underlineY + 18;
    let dynamicDescription;
    if (customMessage) {
      dynamicDescription = customMessage;
    } else {
      const eventDateStr = new Date(eventDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      dynamicDescription = `For outstanding participation and valuable contribution to ${eventName} held on ${eventDateStr} at La Verdad Christian College - Apalit, Pampanga. This certificate recognizes dedication, enthusiasm, and commitment demonstrated throughout the event.`;

      if (certificateType === "achievement") {
        dynamicDescription = `For exceptional achievement and distinguished performance in ${eventName} held on ${eventDateStr} at La Verdad Christian College - Apalit, Pampanga. This certificate honors the remarkable accomplishments and dedication shown during the event.`;
      } else if (certificateType === "completion") {
        dynamicDescription = `For successfully completing ${eventName} held on ${eventDateStr} at La Verdad Christian College - Apalit, Pampanga. This certificate acknowledges the successful fulfillment of all requirements and active engagement throughout the program.`;
      }
    }

    const paraWidth = pageWidth - 200;
    doc.font("Helvetica").fontSize(15).fillColor("#4b5563");
    doc.text(dynamicDescription, (pageWidth - paraWidth) / 2, paraY, {
      align: "center",
      width: paraWidth,
      lineGap: 4,
    });

    this.drawSignatureArea(doc, formCustomizations);
    doc.restore();
  }

  drawSignatureArea(doc, formCustomizations = null) {
    const width = doc.page.width;
    const height = doc.page.height;
    const signatureY = height - 140;

    const colWidth = 240;
    const leftX = width / 2 - colWidth - 40;
    const rightX = width / 2 + 40;
    const lineWidth = 180;

    // Use custom colors if provided
    const primaryColor = formCustomizations?.primaryColor || "#0f3b66";
    const secondaryColor = formCustomizations?.secondaryColor || "#d4af37";

    // Draw decorative lines above signatures
    doc.save();
    doc.strokeColor(secondaryColor).lineWidth(1);

    // Left signature line
    const leftLineX = leftX + (colWidth - lineWidth) / 2;
    doc
      .moveTo(leftLineX, signatureY - 15)
      .lineTo(leftLineX + lineWidth, signatureY - 15)
      .stroke();

    // Right signature line
    const rightLineX = rightX + (colWidth - lineWidth) / 2;
    doc
      .moveTo(rightLineX, signatureY - 15)
      .lineTo(rightLineX + lineWidth, signatureY - 15)
      .stroke();
    doc.restore();

    // Signature spacing - more elegant layout
    const signatureSpacing = 28;
    const titleSpacing = 18;

    // Left signature - use custom names if provided
    const signature1Name = formCustomizations?.signature1Name || "Dr. Sharene T. Labung";
    const signature1Title = formCustomizations?.signature1Title || "Chancellor / Administrator";

    doc.save();
    doc.font("Helvetica-Bold").fontSize(16).fillColor(primaryColor);
    doc.text(signature1Name, leftX, signatureY + 5, {
      width: colWidth,
      align: "center",
    });
    doc.restore();

    doc.save();
    doc.font("Helvetica").fontSize(11).fillColor("#6b7280");
    doc.text(signature1Title, leftX, signatureY + signatureSpacing, {
      width: colWidth,
      align: "center",
    });
    doc.restore();

    // Right signature - use custom names if provided
    const signature2Name = formCustomizations?.signature2Name || "Luckie Christine Villanueva";
    const signature2Title = formCustomizations?.signature2Title || "PSAS Department Head";

    doc.save();
    doc.font("Helvetica-Bold").fontSize(16).fillColor(primaryColor);
    doc.text(signature2Name, rightX, signatureY + 5, {
      width: colWidth,
      align: "center",
    });
    doc.restore();

    doc.save();
    doc.font("Helvetica").fontSize(11).fillColor("#6b7280");
    doc.text(signature2Title, rightX, signatureY + signatureSpacing, {
      width: colWidth,
      align: "center",
    });
    doc.restore();

    // Add small decorative elements at the corners of signature lines
    doc.save();
    doc.strokeColor("#d4af37").lineWidth(0.5);

    // Left corner decoration
    doc.circle(leftLineX, signatureY - 15, 2).stroke();
    doc.circle(leftLineX + lineWidth, signatureY - 15, 2).stroke();

    // Right corner decoration
    doc.circle(rightLineX, signatureY - 15, 2).stroke();
    doc.circle(rightLineX + lineWidth, signatureY - 15, 2).stroke();

    doc.restore();
  }

  async sendCertificateByEmail(certificateData, pdfPath, maxRetries = 3) {
    const { user, event, certificateId } = certificateData;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[EMAIL-RETRY] Attempt ${attempt}/${maxRetries} for certificate ${certificateId}`);

        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: user.email,
          subject: `Certificate of Participation - ${event.name}`,
          html: this.generateEmailTemplate(certificateData),
          attachments: [
            {
              filename: `Certificate_${certificateId}.pdf`,
              path: pdfPath,
            },
          ],
        };

        const result = await this.transporter.sendMail(mailOptions);

        // Update certificate record on successful send
        await Certificate.findOneAndUpdate(
          { certificateId },
          {
            isEmailSent: true,
            emailSentDate: new Date(),
            emailRetryCount: attempt - 1,
            emailLastAttempt: new Date(),
            emailError: null,
          }
        );

        console.log(`[EMAIL-RETRY] ✓ Email sent successfully for certificate ${certificateId} on attempt ${attempt}`);
        return result;

      } catch (error) {
        lastError = error;
        console.error(`[EMAIL-RETRY] ✗ Attempt ${attempt}/${maxRetries} failed for certificate ${certificateId}:`, error.message);

        // Update certificate record with retry information
        await Certificate.findOneAndUpdate(
          { certificateId },
          {
            emailRetryCount: attempt,
            emailLastAttempt: new Date(),
            emailError: error.message,
            emailNextRetry: attempt < maxRetries ? new Date(Date.now() + Math.pow(2, attempt) * 60000) : null, // Exponential backoff
          }
        );

        // Wait before retry (exponential backoff: 1min, 2min, 4min)
        if (attempt < maxRetries) {
          const delayMs = Math.pow(2, attempt) * 60000; // 2^attempt minutes
          console.log(`[EMAIL-RETRY] Waiting ${delayMs/1000}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // All retries failed - mark as failed and create notification
    console.error(`[EMAIL-RETRY] ❌ All ${maxRetries} email attempts failed for certificate ${certificateId}`);

    await Certificate.findOneAndUpdate(
      { certificateId },
      {
        isEmailSent: false,
        emailDeliveryFailed: true,
        emailFinalError: lastError.message,
        emailRetryCount: maxRetries,
      }
    );

    // Create notification for the user about email failure
    try {
      const notificationService = require("../../services/notificationService");
      await notificationService.notifyCertificateEmailFailed({
        _id: certificateData.certificateId,
        certificateId: certificateData.certificateId,
        eventId: { name: certificateData.event.name }
      }, certificateData.user._id);
    } catch (notificationError) {
      console.error("[EMAIL-RETRY] Failed to create email failure notification:", notificationError);
    }

    throw lastError;
  }


  generateEmailTemplate(certificateData) {
    const { user, event, certificateType } = certificateData;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2C3E50;">Certificate of Participation</h2>
        <p>Dear ${user.name},</p>
        <p>Congratulations! We are pleased to present you with your certificate for participating in:</p>
        <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px;">
          <h3 style="margin-top: 0; color: #2C3E50;">${event.name}</h3>
          <p><strong>Date:</strong> ${new Date(
            event.date
          ).toLocaleDateString()}</p>
          <p><strong>Type:</strong> ${
            certificateType.charAt(0).toUpperCase() + certificateType.slice(1)
          } Certificate</p>
        </div>
        <p>Your certificate is attached to this email as a PDF file. You can also download it from your dashboard at any time.</p>
        <p>If you have any questions about your certificate, please don't hesitate to contact us.</p>
        <p>Best regards,<br>La Verdad Christian College - Event Management Team</p>
      </div>
    `;
  }

  async generateCertificateFromTemplate(templateId, certificateData) {
    try {
      const { user, event, certificateId, studentName } = certificateData;

      console.log(`Loading template from path: ${templateId}`);

      // Load template from client templates directory
      const templatePath = path.join(
        __dirname,
        "../../../client/src/templates",
        `${templateId}.json`
      );

      console.log(`Full template path: ${templatePath}`);
      console.log(`Template file exists: ${fs.existsSync(templatePath)}`);

      if (!fs.existsSync(templatePath)) {
        throw new Error(
          `Template ${templateId} not found at path: ${templatePath}`
        );
      }

      const templateData = JSON.parse(fs.readFileSync(templatePath, "utf8"));
      console.log(
        `Template loaded successfully, objects count: ${
          templateData.objects?.length || 0
        }`
      );

      // Create canvas with template dimensions
      const canvas = createCanvas(
        templateData.width || 1056,
        templateData.height || 816
      );
      const ctx = canvas.getContext("2d");

      // Set white background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render template objects
      for (const obj of templateData.objects || []) {
        await this.renderFabricObject(ctx, obj, certificateData);
      }

      // Convert canvas to PDF
      const pdfDoc = new PDFDocument({
        size: [canvas.width, canvas.height],
        margin: 0,
      });

      const pdfPath = path.resolve(
        this.certificatesDir,
        `${certificateId}_${studentName || user.name || "Participant"}.pdf`
      );
      const pdfStream = fs.createWriteStream(pdfPath);
      pdfDoc.pipe(pdfStream);

      // Add canvas image to PDF
      const canvasImageData = canvas.toDataURL("image/png").split(",")[1];
      const canvasImageBuffer = Buffer.from(canvasImageData, "base64");

      pdfDoc.image(canvasImageBuffer, 0, 0, {
        width: canvas.width,
        height: canvas.height,
      });

      pdfDoc.end();

      return new Promise((resolve, reject) => {
        pdfStream.on("finish", () => {
          resolve({
            filePath: pdfPath,
            fileName: path.basename(pdfPath),
          });
        });
        pdfStream.on("error", reject);
      });
    } catch (error) {
      console.error("Error generating certificate from template:", error);
      throw error;
    }
  }

  async renderFabricObject(ctx, obj, certificateData) {
    const { user, event, studentName } = certificateData;

    ctx.save();

    // Handle different object types
    switch (obj.type) {
      case "rect":
        this.renderRectangle(ctx, obj);
        break;
      case "textbox":
        await this.renderTextbox(ctx, obj, certificateData);
        break;
      case "line":
        this.renderLine(ctx, obj);
        break;
      case "circle":
        this.renderCircle(ctx, obj);
        break;
      case "triangle":
        this.renderTriangle(ctx, obj);
        break;
      case "polygon":
        this.renderPolygon(ctx, obj);
        break;
      case "image":
        await this.renderImage(ctx, obj);
        break;
      default:
        console.warn(`Unsupported object type: ${obj.type}`);
    }

    ctx.restore();
  }

  renderRectangle(ctx, obj) {
    ctx.fillStyle = obj.fill || "transparent";
    ctx.strokeStyle = obj.stroke || "transparent";
    ctx.lineWidth = obj.strokeWidth || 1;

    if (obj.fill && obj.fill !== "transparent") {
      ctx.fillRect(obj.left, obj.top, obj.width, obj.height);
    }
    if (obj.stroke && obj.stroke !== "transparent") {
      ctx.strokeRect(obj.left, obj.top, obj.width, obj.height);
    }
  }

  async renderTextbox(ctx, obj, certificateData) {
    const { user, event, studentName } = certificateData;

    // Replace placeholder text
    let text = obj.text || "";
    text = text.replace(
      /Recipient Name|Participant Name/gi,
      studentName || user.name || "Participant"
    );
    text = text.replace(/Event Name/gi, event.name || "Event");

    ctx.fillStyle = obj.fill || "#000000";
    ctx.font = `${obj.fontWeight || "normal"} ${obj.fontSize || 24}px ${
      obj.fontFamily || "Arial"
    }`;
    ctx.textAlign = obj.textAlign || "left";
    ctx.textBaseline = "top";

    // Handle text wrapping for multi-line text
    if (text.includes("\n")) {
      const lines = text.split("\n");
      let y = obj.top;
      const lineHeight = obj.lineHeight
        ? obj.fontSize * obj.lineHeight
        : obj.fontSize * 1.2;

      for (const line of lines) {
        ctx.fillText(line, obj.left, y);
        y += lineHeight;
      }
    } else {
      ctx.fillText(text, obj.left, obj.top);
    }
  }

  renderLine(ctx, obj) {
    ctx.strokeStyle = obj.stroke || "#000000";
    ctx.lineWidth = obj.strokeWidth || 1;
    ctx.beginPath();
    ctx.moveTo(obj.x1, obj.y1);
    ctx.lineTo(obj.x2, obj.y2);
    ctx.stroke();
  }

  renderCircle(ctx, obj) {
    ctx.fillStyle = obj.fill || "transparent";
    ctx.strokeStyle = obj.stroke || "transparent";
    ctx.lineWidth = obj.strokeWidth || 1;

    ctx.beginPath();
    ctx.arc(
      obj.left + obj.radius,
      obj.top + obj.radius,
      obj.radius,
      0,
      2 * Math.PI
    );

    if (obj.fill && obj.fill !== "transparent") {
      ctx.fill();
    }
    if (obj.stroke && obj.stroke !== "transparent") {
      ctx.stroke();
    }
  }

  renderTriangle(ctx, obj) {
    ctx.fillStyle = obj.fill || "transparent";
    ctx.strokeStyle = obj.stroke || "transparent";
    ctx.lineWidth = obj.strokeWidth || 1;

    ctx.beginPath();
    ctx.moveTo(obj.left + obj.width / 2, obj.top);
    ctx.lineTo(obj.left, obj.top + obj.height);
    ctx.lineTo(obj.left + obj.width, obj.top + obj.height);
    ctx.closePath();

    if (obj.fill && obj.fill !== "transparent") {
      ctx.fill();
    }
    if (obj.stroke && obj.stroke !== "transparent") {
      ctx.stroke();
    }
  }

  renderPolygon(ctx, obj) {
    if (!obj.points || obj.points.length === 0) return;

    ctx.fillStyle = obj.fill || "transparent";
    ctx.strokeStyle = obj.stroke || "transparent";
    ctx.lineWidth = obj.strokeWidth || 1;

    ctx.beginPath();
    ctx.moveTo(obj.left + obj.points[0].x, obj.top + obj.points[0].y);

    for (let i = 1; i < obj.points.length; i++) {
      ctx.lineTo(obj.left + obj.points[i].x, obj.top + obj.points[i].y);
    }

    ctx.closePath();

    if (obj.fill && obj.fill !== "transparent") {
      ctx.fill();
    }
    if (obj.stroke && obj.stroke !== "transparent") {
      ctx.stroke();
    }
  }

  async renderImage(ctx, obj) {
    // For now, skip images as they require additional handling
    // This can be implemented later if needed
    console.log(
      "Image rendering not yet implemented for server-side templates"
    );
  }

  async generateCertificate(userId, eventId, options = {}) {
    try {
      console.log(`[CERT-SVC] generateCertificate called with:`, {
        userId,
        eventId,
        hasTemplateId: !!options.templateId,
        templateId: options.templateId,
        respondentName: options.respondentName,
        respondentEmail: options.respondentEmail,
        hasFormId: !!options.formId,
      });

      const User = require("../../models/User");
      const Event = require("../../models/Event");
      const Form = require("../../models/Form");

      const [user, event] = await Promise.all([
        User.findById(userId),
        Event.findById(eventId),
      ]);

      console.log(`[CERT-SVC] User lookup:`, { found: !!user, userId });
      console.log(`[CERT-SVC] Event lookup:`, { found: !!event, eventId });

      if (!user || !event) {
        console.error(`[CERT-SVC] Missing user or event:`, {
          user: !!user,
          event: !!event,
        });
        throw new Error("User or Event not found");
      }

      // Get form customizations if formId is provided
      let formCustomizations = null;
      if (options.formId) {
        const form = await Form.findById(options.formId);
        if (form && form.certificateCustomizations) {
          formCustomizations = form.certificateCustomizations;
          console.log(`[CERT-SVC] Loaded form customizations:`, formCustomizations);
        }
      }

      const certificateId = this.generateCertificateId();
      console.log(`[CERT-SVC] Generated certificateId:`, certificateId);

      const certificateData = {
        user,
        event,
        certificateId,
        certificateType: options.certificateType || "participation",
        customMessage: options.customMessage,
        studentName: options.respondentName || options.studentName,
        formCustomizations, // Include form customizations
      };

      let pdfResult;

      // Check if templateId is provided and use template-based generation
      if (options.templateId) {
        console.log(
          `[CERT-SVC] ✓ Generating certificate from template: ${options.templateId}`
        );
        console.log(`[CERT-SVC] Template certificate data:`, certificateData);
        pdfResult = await this.generateCertificateFromTemplate(
          options.templateId,
          certificateData
        );
        console.log(`[CERT-SVC] PDF generated from template:`, {
          filePath: pdfResult.filePath,
          fileName: pdfResult.fileName,
        });
      } else {
        // Fall back to default PDF generation
        console.log(
          `[CERT-SVC] Generating certificate using default PDF template`
        );
        pdfResult = await this.generateCertificatePDF(certificateData);
        console.log(`[CERT-SVC] PDF generated from default template:`, {
          filePath: pdfResult.filePath,
          fileName: pdfResult.fileName,
        });
      }

      console.log(`[CERT-SVC] Creating Certificate document in database...`);
      const certificate = new Certificate({
        userId,
        eventId,
        formId: options.formId,
        certificateType: certificateData.certificateType,
        certificateId,
        filePath: pdfResult.filePath,
        customMessage: options.customMessage,
        respondentEmail: options.respondentEmail,
        respondentName: options.respondentName,
        templateId: options.templateId || null,
        metadata: {
          generatedAt: new Date(),
          pdfFileName: pdfResult.fileName,
        },
      });

      await certificate.save();
      console.log(`[CERT-SVC] Certificate saved to database:`, {
        certificateId,
        respondentEmail: options.respondentEmail,
      });

      if (options.sendEmail !== false) {
        try {
          console.log(
            `[CERT-SVC] Sending certificate email to:`,
            options.respondentEmail
          );
          await this.sendCertificateByEmail(
            certificateData,
            pdfResult.filePath
          );
          console.log(`[CERT-SVC] ✓ Email sent successfully`);
        } catch (emailError) {
          console.error(
            `[CERT-SVC] ✗ Failed to send certificate email:`,
            emailError.message
          );
        }
      }

      console.log(
        `[CERT-SVC] Certificate generation complete - returning success`
      );
      return {
        success: true,
        certificateId,
        filePath: pdfResult.filePath,
        downloadUrl: `/api/certificates/download/${certificateId}`,
      };
    } catch (error) {
      console.error("Error generating certificate:", error);
      throw error;
    }
  }

  async getCertificate(certificateId) {
    try {
      const certificate = await Certificate.findOne({ certificateId })
        .populate("userId", "name email")
        .populate("eventId", "name date");

      if (!certificate) {
        throw new Error("Certificate not found");
      }

      return certificate;
    } catch (error) {
      throw error;
    }
  }

  async generateBulkCertificates(eventId, participantIds, options = {}) {
    try {
      const results = [];

      for (const userId of participantIds) {
        try {
          const result = await this.generateCertificate(
            userId,
            eventId,
            options
          );
          results.push({
            userId,
            success: true,
            certificateId: result.certificateId,
          });
        } catch (error) {
          results.push({
            userId,
            success: false,
            error: error.message,
          });
        }
      }

      return results;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new CertificateService();
