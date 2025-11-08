const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const Certificate = require("../../models/Certificate");

class CertificateService {
  static validateCertificatePath(basePath, filePath) {
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
    const { user, event, certificateType, customMessage, certificateId, studentName } =
      certificateData;

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

        this.drawCertificateBackground(doc);
        this.drawCertificateContent(doc, {
          userName: studentName || user.name || "Participant",
          eventName: event.name,
          eventDate: event.date,
          certificateType,
          customMessage,
          certificateId,
          issuedDate: new Date(),
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

  drawCertificateBackground(doc) {
    const width = doc.page.width;
    const height = doc.page.height;

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
    doc.fillColor("#0f3b66").fill();
    doc.restore();

    doc.save();
    doc
      .moveTo(0, 40)
      .lineTo(width, 0)
      .lineTo(width, 80)
      .bezierCurveTo(width * 0.7, 120, width * 0.3, 40, 0, 80)
      .closePath();
    doc.fillColor("#e9c779").fill();
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
    doc.fillColor("#0f3b66").fill();
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
    doc.fillColor("#ecd6a3").fill();
    doc.restore();

    doc.save();
    doc.lineWidth(3);
    doc.strokeColor("#d7b65b");
    const inset = 28;
    doc.rect(inset, inset, width - inset * 2, height - inset * 2).stroke();
    doc.restore();

    this.drawGoldSeal(doc, 70, 80);
  }

  drawGoldSeal(doc, x, y) {
    const shadow = "#c17b06";
    const outer = "#f0b83a";
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
    } = data;

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const centerX = pageWidth / 2;

    doc.save();

    doc.font("Helvetica-Bold").fontSize(36).fillColor("#0f3b66");
    doc.text("CERTIFICATE", 0, 120, { align: "center", width: pageWidth });
    doc.font("Helvetica").fontSize(18).fillColor("#0f3b66");
    doc.text("OF PARTICIPATION", 0, 160, {
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

    this.drawSignatureArea(doc);
    doc.restore();
  }

  drawSignatureArea(doc) {
    const width = doc.page.width;
    const height = doc.page.height;
    const signatureY = height - 150;

    const colWidth = 220;
    const leftX = width / 2 - colWidth - 20;
    const rightX = width / 2 + 20;

    doc.font("Helvetica-Bold").fontSize(15).fillColor("#0f3b66");
    doc.text("Dr. Sharene T. Labung", leftX, signatureY, {
      width: colWidth,
      align: "center",
    });
    doc.font("Helvetica").fontSize(12).fillColor("#374151");
    doc.text("Chancellor / Administrator", leftX, signatureY + 18, {
      width: colWidth,
      align: "center",
    });

    doc.font("Helvetica-Bold").fontSize(15).fillColor("#0f3b66");
    doc.text("Luckie Kristine Villanueva", rightX, signatureY, {
      width: colWidth,
      align: "center",
    });
    doc.font("Helvetica").fontSize(12).fillColor("#374151");
    doc.text("PSAS Department Head", rightX, signatureY + 18, {
      width: colWidth,
      align: "center",
    });
  }

  async sendCertificateByEmail(certificateData, pdfPath) {
    try {
      const { user, event, certificateId } = certificateData;

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

      await Certificate.findOneAndUpdate(
        { certificateId },
        {
          isEmailSent: true,
          emailSentDate: new Date(),
        }
      );

      return result;
    } catch (error) {
      console.error("Error sending certificate email:", error);
      throw error;
    }
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

  async generateCertificate(userId, eventId, options = {}) {
    try {
      const User = require("../../models/User");
      const Event = require("../../models/Event");

      const [user, event] = await Promise.all([
        User.findById(userId),
        Event.findById(eventId),
      ]);

      if (!user || !event) {
        throw new Error("User or Event not found");
      }

      const certificateId = this.generateCertificateId();

      const certificateData = {
        user,
        event,
        certificateId,
        certificateType: options.certificateType || "participation",
        customMessage: options.customMessage,
        studentName: options.studentName,
      };

      const pdfResult = await this.generateCertificatePDF(certificateData);

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
        metadata: {
          generatedAt: new Date(),
          pdfFileName: pdfResult.fileName,
        },
      });

      await certificate.save();

      if (options.sendEmail !== false) {
        try {
          await this.sendCertificateByEmail(
            certificateData,
            pdfResult.filePath
          );
        } catch (emailError) {
          console.error("Failed to send certificate email:", emailError);
        }
      }

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
