const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const Certificate = require('../../models/Certificate');

class CertificateService {
  constructor() {
    // Create uploads directory if it doesn't exist
    this.certificatesDir = path.join(__dirname, '../../uploads/certificates');
    if (!fs.existsSync(this.certificatesDir)) {
      fs.mkdirSync(this.certificatesDir, { recursive: true });
    }

    // Configure nodemailer transporter
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  /**
   * Generate a unique certificate ID
   */
  generateCertificateId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `CERT-${timestamp}-${random}`;
  }

  /**
   * Create certificate PDF
   */
  async generateCertificatePDF(certificateData) {
    const { user, event, certificateType, customMessage, certificateId } = certificateData;

    return new Promise((resolve, reject) => {
      try {
        const fileName = `${certificateId}_${user.name.replace(/\s+/g, '_')}.pdf`;
        const filePath = path.join(this.certificatesDir, fileName);

        const doc = new PDFDocument({
          size: 'A4',
          layout: 'landscape',
          margin: 40,
        });

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Certificate background and styling
        this.drawCertificateBackground(doc);

        // Certificate content
        this.drawCertificateContent(doc, {
          userName: user.name,
          eventName: event.name,
          eventDate: event.date,
          certificateType,
          customMessage,
          certificateId,
          issuedDate: new Date(),
        });

        doc.end();

        stream.on('finish', () => {
          resolve({
            filePath,
            fileName,
          });
        });

        stream.on('error', (error) => {
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Draw certificate background and border
   */
  drawCertificateBackground(doc) {
    const width = doc.page.width;
    const height = doc.page.height;
    const margin = 40;

    // Fill background with white
    doc.rect(0, 0, width, height)
       .fill('#FFFFFF');

    // Draw decorative corner curves (top-left)
    doc.save();
    doc.translate(margin, margin);
    this.drawDecorativeCorner(doc, 0, 0, true);
    doc.restore();

    // Draw decorative corner curves (top-right)
    doc.save();
    doc.translate(width - margin, margin);
    this.drawDecorativeCorner(doc, 0, 0, false);
    doc.restore();

    // Draw decorative corner curves (bottom-left)
    doc.save();
    doc.translate(margin, height - margin);
    this.drawDecorativeCorner(doc, 0, 0, true);
    doc.restore();

    // Draw decorative corner curves (bottom-right)
    doc.save();
    doc.translate(width - margin, height - margin);
    this.drawDecorativeCorner(doc, 0, 0, false);
    doc.restore();

    // Draw main navy border
    doc.lineWidth(4)
       .rect(margin, margin, width - (2 * margin), height - (2 * margin))
       .stroke('#1e3a8a');

    // Draw gold seal/medal on left side
    this.drawGoldSeal(doc, 80, height / 2 - 40);
  }

  /**
   * Draw decorative corner elements
   */
  drawDecorativeCorner(doc, x, y, isLeft) {
    const curveSize = 60;
    const goldColor = '#f59e0b';

    doc.save();

    if (isLeft) {
      // Top-left corner curves
      doc.strokeColor(goldColor)
         .lineWidth(6)
         .moveTo(x + curveSize, y)
         .lineTo(x + curveSize - 20, y)
         .quadraticCurveTo(x + curveSize - 30, y, x + curveSize - 30, y + 10)
         .quadraticCurveTo(x + curveSize - 30, y + 20, x + curveSize - 20, y + 20)
         .lineTo(x + curveSize, y + 20)
         .stroke();

      doc.strokeColor(goldColor)
         .lineWidth(6)
         .moveTo(x, y + curveSize)
         .lineTo(x, y + curveSize - 20)
         .quadraticCurveTo(x, y + curveSize - 30, x + 10, y + curveSize - 30)
         .quadraticCurveTo(x + 20, y + curveSize - 30, x + 20, y + curveSize - 20)
         .lineTo(x + 20, y + curveSize)
         .stroke();
    } else {
      // Top-right corner curves (mirrored)
      doc.strokeColor(goldColor)
         .lineWidth(6)
         .moveTo(x - curveSize, y)
         .lineTo(x - curveSize + 20, y)
         .quadraticCurveTo(x - curveSize + 30, y, x - curveSize + 30, y + 10)
         .quadraticCurveTo(x - curveSize + 30, y + 20, x - curveSize + 20, y + 20)
         .lineTo(x - curveSize, y + 20)
         .stroke();

      doc.strokeColor(goldColor)
         .lineWidth(6)
         .moveTo(x, y + curveSize)
         .lineTo(x, y + curveSize - 20)
         .quadraticCurveTo(x, y + curveSize - 30, x - 10, y + curveSize - 30)
         .quadraticCurveTo(x - 20, y + curveSize - 30, x - 20, y + curveSize - 20)
         .lineTo(x - 20, y + curveSize)
         .stroke();
    }

    doc.restore();
  }

  /**
   * Draw gold seal/medal
   */
  drawGoldSeal(doc, x, y) {
    const goldColor = '#f59e0b';
    const innerGold = '#fbbf24';
    const shadowColor = '#d97706';

    // Outer shadow/border
    doc.circle(x + 2, y + 2, 35)
       .fill(shadowColor);

    // Main seal circle
    doc.circle(x, y, 35)
       .fill(goldColor);

    // Inner highlight circle
    doc.circle(x - 5, y - 5, 25)
       .fill(innerGold);

    // Center dot for medal effect
    doc.circle(x - 5, y - 5, 8)
       .fill(goldColor);

    // Add star-like effect
    doc.save();
    doc.translate(x - 5, y - 5);
    doc.strokeColor(goldColor).lineWidth(2);
    for (let i = 0; i < 8; i++) {
      doc.rotate((Math.PI * 2) / 8);
      doc.moveTo(15, 0)
         .lineTo(20, 0)
         .stroke();
    }
    doc.restore();
  }

  /**
   * Draw certificate content
   */
  drawCertificateContent(doc, data) {
    const { userName, eventName, eventDate, certificateType, customMessage, certificateId, issuedDate } = data;

    // Save initial state
    doc.save();

    // Title
    doc.fontSize(32)
       .fillColor('#1e3a8a')
       .font('Helvetica-Bold')
       .text('CERTIFICATE', 0, 80, {
         align: 'center',
         width: doc.page.width,
       })
       .fontSize(24)
       .text('OF PARTICIPATION', 0, 115, {
         align: 'center',
         width: doc.page.width,
       });

    // Subtitle
    doc.fontSize(14)
       .fillColor('#374151')
       .font('Helvetica')
       .text('This certificate is proudly presented to', 0, 180, {
         align: 'center',
         width: doc.page.width,
       });

    // Participant name (large and gold)
    doc.fontSize(36)
       .fillColor('#b45309')
       .font('Helvetica-Bold')
       .text(userName.toUpperCase(), 0, 220, {
         align: 'center',
         width: doc.page.width,
       });

    // Event description (centered paragraph)
    const descriptionText = `For successfully participating in ${eventName} held on ${new Date(eventDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })} at La Verdad Christian College - Apalit, Pampanga.`;

    doc.fontSize(12)
       .fillColor('#4b5563')
       .font('Helvetica')
       .text(descriptionText, 0, 320, {
         align: 'center',
         width: doc.page.width - 200,
         x: 100, // Indent from sides
       });

    // Custom message if provided
    if (customMessage) {
      doc.fontSize(11)
         .fillColor('#6b7280')
         .font('Helvetica-Oblique')
         .text(`"${customMessage}"`, 0, 400, {
           align: 'center',
           width: doc.page.width - 200,
           x: 100,
         });
    }

    // Certificate ID (small, bottom center)
    doc.fontSize(8)
       .fillColor('#6b7280')
       .font('Helvetica')
       .text(`Certificate ID: ${certificateId}`, 0, doc.page.height - 120, {
         align: 'center',
         width: doc.page.width,
       });

    // Issued date
    doc.fontSize(8)
       .fillColor('#6b7280')
       .font('Helvetica')
       .text(`Issued on: ${issuedDate.toLocaleDateString()}`, 0, doc.page.height - 100, {
         align: 'center',
         width: doc.page.width,
       });

    // Signature area
    this.drawSignatureArea(doc);

    // Restore graphics state
    doc.restore();
  }

  /**
   * Draw signature area
   */
  drawSignatureArea(doc) {
    const width = doc.page.width;
    const height = doc.page.height;
    const signatureY = height - 160;

    // Left signature section
    this.drawSignatureLine(doc, 120, signatureY, 'Dr. Sharene T. Labung');
    doc.fontSize(10)
       .fillColor('#374151')
       .font('Helvetica')
       .text('Chancellor / Administrator', 70, signatureY + 25, {
         align: 'center',
         width: 100,
       });

    // Right signature section
    this.drawSignatureLine(doc, width - 120, signatureY, 'Luckie Kristine Villanueva');
    doc.fontSize(10)
       .fillColor('#374151')
       .font('Helvetica')
       .text('PSAS Department Head', width - 170, signatureY + 25, {
         align: 'center',
         width: 100,
       });

    // Organization name at bottom center
    doc.fontSize(12)
       .fillColor('#1e3a8a')
       .font('Helvetica-Bold')
       .text('La Verdad Christian College - Apalit, Pampanga', 0, height - 60, {
         align: 'center',
         width: width,
       });
  }

  /**
   * Draw individual signature line
   */
  drawSignatureLine(doc, centerX, y, name) {
    const lineWidth = 100;
    const startX = centerX - (lineWidth / 2);

    // Signature line
    doc.strokeColor('#374151')
       .lineWidth(1)
       .moveTo(startX, y)
       .lineTo(startX + lineWidth, y)
       .stroke();

    // Name below the line
    doc.fontSize(11)
       .fillColor('#1f2937')
       .font('Helvetica-Bold')
       .text(name, centerX - (lineWidth / 2), y + 8, {
         align: 'center',
         width: lineWidth,
       });
  }

  /**
   * Send certificate via email
   */
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

      // Update certificate record to mark email as sent
      await Certificate.findOneAndUpdate(
        { certificateId },
        {
          isEmailSent: true,
          emailSentDate: new Date(),
        }
      );

      return result;
    } catch (error) {
      console.error('Error sending certificate email:', error);
      throw error;
    }
  }

  /**
   * Generate email template
   */
  generateEmailTemplate(certificateData) {
    const { user, event, certificateType } = certificateData;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2C3E50;">Certificate of Participation</h2>
        <p>Dear ${user.name},</p>
        <p>Congratulations! We are pleased to present you with your certificate for participating in:</p>
        <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px;">
          <h3 style="margin-top: 0; color: #2C3E50;">${event.name}</h3>
          <p><strong>Date:</strong> ${new Date(event.date).toLocaleDateString()}</p>
          <p><strong>Type:</strong> ${certificateType.charAt(0).toUpperCase() + certificateType.slice(1)} Certificate</p>
        </div>
        <p>Your certificate is attached to this email as a PDF file. You can also download it from your dashboard at any time.</p>
        <p>If you have any questions about your certificate, please don't hesitate to contact us.</p>
        <p>Best regards,<br>La Verdad Christian College - Event Management Team</p>
      </div>
    `;
  }

  /**
   * Generate certificate for user and event
   */
  async generateCertificate(userId, eventId, options = {}) {
    try {
      const User = require('../../models/User');
      const Event = require('../../models/Event');

      const [user, event] = await Promise.all([
        User.findById(userId),
        Event.findById(eventId),
      ]);

      if (!user || !event) {
        throw new Error('User or Event not found');
      }

      const certificateId = this.generateCertificateId();

      const certificateData = {
        user,
        event,
        certificateId,
        certificateType: options.certificateType || 'participation',
        customMessage: options.customMessage,
      };

      // Generate PDF
      const pdfResult = await this.generateCertificatePDF(certificateData);

      // Save certificate record to database
      const certificate = new Certificate({
        userId,
        eventId,
        certificateType: certificateData.certificateType,
        certificateId,
        filePath: pdfResult.filePath,
        customMessage: options.customMessage,
        metadata: {
          generatedAt: new Date(),
          pdfFileName: pdfResult.fileName,
        },
      });

      await certificate.save();

      // Send email if requested
      if (options.sendEmail !== false) {
        try {
          await this.sendCertificateByEmail(certificateData, pdfResult.filePath);
        } catch (emailError) {
          console.error('Failed to send certificate email:', emailError);
          // Don't throw error here, certificate is already generated
        }
      }

      return {
        success: true,
        certificateId,
        filePath: pdfResult.filePath,
        downloadUrl: `/api/certificates/download/${certificateId}`,
      };

    } catch (error) {
      console.error('Error generating certificate:', error);
      throw error;
    }
  }

  /**
   * Get certificate by ID
   */
  async getCertificate(certificateId) {
    try {
      const certificate = await Certificate.findOne({ certificateId })
        .populate('userId', 'name email')
        .populate('eventId', 'name date');

      if (!certificate) {
        throw new Error('Certificate not found');
      }

      return certificate;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate certificates for multiple participants in an event
   */
  async generateBulkCertificates(eventId, participantIds, options = {}) {
    try {
      const results = [];

      for (const userId of participantIds) {
        try {
          const result = await this.generateCertificate(userId, eventId, options);
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