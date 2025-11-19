const certificateService = require("../../services/certificate/certificateService");
const Certificate = require("../../models/Certificate");
const fs = require("fs");
const path = require("path");

/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 */

class CertificateController {
  /**
   * Generate a single certificate
   * POST /api/certificates/generate
   */
  async generateCertificate(req, res) {
    try {
      if (!req.body) {
        return res.status(400).json({
          success: false,
          message: "Request body is required",
        });
      }

      const { userId, eventId, certificateType, customMessage, sendEmail, studentName } =
        req.body;

      if (!userId || !eventId) {
        return res.status(400).json({
          success: false,
          message: "User ID and Event ID are required",
        });
      }

      const options = {
        certificateType: certificateType || "participation",
        customMessage,
        sendEmail: sendEmail !== false,
        studentName,
      };

      const result = await certificateService.generateCertificate(
        userId,
        eventId,
        options
      );

      res.status(201).json({
        success: true,
        message: "Certificate generated successfully",
        data: result,
      });
    } catch (error) {
      console.error("Error generating certificate:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate certificate",
        error: error.message,
      });
    }
  }

  /**
   * Generate certificates for multiple participants
   * POST /api/certificates/generate-bulk
   */
  async generateBulkCertificates(req, res) {
    try {
      if (!req.body) {
        return res.status(400).json({
          success: false,
          message: "Request body is required",
        });
      }

      const {
        eventId,
        participantIds,
        certificateType,
        customMessage,
        sendEmail,
      } = req.body;

      if (!eventId || !participantIds || !Array.isArray(participantIds)) {
        return res.status(400).json({
          success: false,
          message: "Event ID and participant IDs array are required",
        });
      }

      const options = {
        certificateType: certificateType || "participation",
        customMessage,
        sendEmail: sendEmail !== false,
      };

      const results = await certificateService.generateBulkCertificates(
        eventId,
        participantIds,
        options
      );

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      res.status(200).json({
        success: true,
        message: `Processed ${results.length} certificates. ${successCount} successful, ${failureCount} failed`,
        data: results,
      });
    } catch (error) {
      console.error("Error generating bulk certificates:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate bulk certificates",
        error: error.message,
      });
    }
  }

  /**
   * Get certificates for a form
   * GET /api/certificates/form/:formId
   */
  async getCertificatesForForm(req, res) {
    try {
      const { formId } = req.params;

      const certificates = await Certificate.find({ formId })
        .populate("userId", "name email")
        .populate("eventId", "name date")
        .sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        data: certificates,
      });
    } catch (error) {
      console.error("Error fetching certificates for form:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch certificates for form",
        error: error.message,
      });
    }
  }

  /**
   * Get certificate by ID
   * GET /api/certificates/:certificateId
   */
  async getCertificate(req, res) {
    try {
      const { certificateId } = req.params;

      const certificate = await certificateService.getCertificate(
        certificateId
      );

      res.status(200).json({
        success: true,
        data: certificate,
      });
    } catch (error) {
      console.error("Error fetching certificate:", error);

      if (error.message === "Certificate not found") {
        return res.status(404).json({
          success: false,
          message: "Certificate not found",
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to fetch certificate",
        error: error.message,
      });
    }
  }

  /**
   * Download certificate PDF
   * GET /api/certificates/download/:certificateId
   */
  async downloadCertificate(req, res) {
    try {
      const { certificateId } = req.params;

      const certificate = await Certificate.findOne({ certificateId });

      if (!certificate) {
        return res.status(404).json({
          success: false,
          message: "Certificate not found",
        });
      }

      const validatedPath = certificateService.validateCertificatePath(
        path.resolve(path.join(__dirname, "../../uploads/certificates")),
        certificate.filePath
      );

      if (!fs.existsSync(validatedPath)) {
        return res.status(404).json({
          success: false,
          message: "Certificate file not found",
        });
      }

      // Check if this is for inline viewing (from certificate viewer)
      const isInline = req.query.inline === 'true';

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        isInline
          ? `inline; filename="${certificate.certificateId}.pdf"`
          : `attachment; filename="${certificate.certificateId}.pdf"`
      );

      const fileStream = fs.createReadStream(validatedPath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error downloading certificate:", error);
      res.status(500).json({
        success: false,
        message: "Failed to download certificate",
        error: error.message,
      });
    }
  }

  /**
   * Get current user's certificates
   * GET /api/certificates/my
   */
  async getMyCertificates(req, res) {
    try {
      const userId = req.user._id;
      console.log('getMyCertificates called for userId:', userId);

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID not found",
        });
      }

      const { page = 1, limit = 10 } = req.query;

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      if (
        isNaN(pageNum) ||
        pageNum < 1 ||
        isNaN(limitNum) ||
        limitNum < 1 ||
        limitNum > 100
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid pagination parameters. Page must be >= 1, limit must be 1-100",
        });
      }

      console.log('Fetching certificates for userId:', userId, 'page:', pageNum, 'limit:', limitNum);

      let certificates;
      try {
        certificates = await Certificate.find({ userId })
          .populate({
            path: "eventId",
            select: "name date",
            options: { lean: true }
          })
          .populate({
            path: "formId",
            select: "title",
            options: { lean: true }
          })
          .sort({ issuedDate: -1 })
          .limit(limitNum)
          .skip((pageNum - 1) * limitNum)
          .lean();
      } catch (populateError) {
        console.error('Error in populate queries:', populateError);
        // Fallback to basic query without populate
        certificates = await Certificate.find({ userId })
          .sort({ issuedDate: -1 })
          .limit(limitNum)
          .skip((pageNum - 1) * limitNum)
          .select('certificateId certificateType issuedDate')
          .lean();
      }

      console.log('Found certificates:', certificates.length);

      const total = await Certificate.countDocuments({ userId });
      console.log('Total certificates:', total);

      res.status(200).json({
        success: true,
        data: certificates,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalCertificates: total,
          hasNextPage: pageNum < Math.ceil(total / limitNum),
          hasPrevPage: pageNum > 1,
        },
      });
    } catch (error) {
      console.error("Error fetching my certificates:", error);
      console.error("Error stack:", error.stack);
      res.status(500).json({
        success: false,
        message: "Failed to fetch your certificates",
        error: error.message,
      });
    }
  }

  /**
   * Get certificates for a user
   * GET /api/certificates/user/:userId
   */
  async getUserCertificates(req, res) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      if (
        isNaN(pageNum) ||
        pageNum < 1 ||
        isNaN(limitNum) ||
        limitNum < 1 ||
        limitNum > 100
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid pagination parameters. Page must be >= 1, limit must be 1-100",
        });
      }

      const certificates = await Certificate.find({ userId })
        .populate("eventId", "name date")
        .sort({ issuedDate: -1 })
        .limit(limitNum)
        .skip((pageNum - 1) * limitNum);

      const total = await Certificate.countDocuments({ userId });

      res.status(200).json({
        success: true,
        data: certificates,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalCertificates: total,
          hasNextPage: pageNum < Math.ceil(total / limitNum),
          hasPrevPage: pageNum > 1,
        },
      });
    } catch (error) {
      console.error("Error fetching user certificates:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch user certificates",
        error: error.message,
      });
    }
  }

  /**
   * Get certificates for an event
   * GET /api/certificates/event/:eventId
   */
  async getEventCertificates(req, res) {
    try {
      const { eventId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      if (
        isNaN(pageNum) ||
        pageNum < 1 ||
        isNaN(limitNum) ||
        limitNum < 1 ||
        limitNum > 100
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid pagination parameters. Page must be >= 1, limit must be 1-100",
        });
      }

      const certificates = await Certificate.find({ eventId })
        .populate("userId", "name email")
        .sort({ issuedDate: -1 })
        .limit(limitNum)
        .skip((pageNum - 1) * limitNum);
      const total = await Certificate.countDocuments({ eventId });

      res.status(200).json({
        success: true,
        data: certificates,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalCertificates: total,
          hasNextPage: pageNum < Math.ceil(total / limitNum),
          hasPrevPage: pageNum > 1,
        },
      });
    } catch (error) {
      console.error("Error fetching event certificates:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch event certificates",
        error: error.message,
      });
    }
  }

  /**
   * Resend certificate email
   * POST /api/certificates/:certificateId/resend
   */
  async resendCertificate(req, res) {
    try {
      const { certificateId } = req.params;

      const certificate = await Certificate.findOne({ certificateId })
        .populate("userId", "name email")
        .populate("eventId", "name date");

      if (!certificate) {
        return res.status(404).json({
          success: false,
          message: "Certificate not found",
        });
      }

      const validatedPath = certificateService.validateCertificatePath(
        path.join(__dirname, "../../uploads/certificates"),
        certificate.filePath
      );

      if (!fs.existsSync(validatedPath)) {
        return res.status(404).json({
          success: false,
          message: "Certificate file not found",
        });
      }

      const certificateData = {
        user: certificate.userId,
        event: certificate.eventId,
        certificateId: certificate.certificateId,
        certificateType: certificate.certificateType,
        customMessage: certificate.customMessage,
      };

      await certificateService.sendCertificateByEmail(
        certificateData,
        validatedPath
      );

      res.status(200).json({
        success: true,
        message: "Certificate email sent successfully",
      });
    } catch (error) {
      console.error("Error resending certificate:", error);
      res.status(500).json({
        success: false,
        message: "Failed to resend certificate",
        error: error.message,
      });
    }
  }

  /**
   * Delete certificate
   * DELETE /api/certificates/:certificateId
   */
  async deleteCertificate(req, res) {
    try {
      const { certificateId } = req.params;

      const certificate = await Certificate.findOne({ certificateId });

      if (!certificate) {
        return res.status(404).json({
          success: false,
          message: "Certificate not found",
        });
      }

      try {
        const validatedPath = certificateService.validateCertificatePath(
          path.join(__dirname, "../../uploads/certificates"),
          certificate.filePath
        );

        if (fs.existsSync(validatedPath)) {
          fs.unlinkSync(validatedPath);
        }
      } catch (fileError) {
        console.error("Error handling certificate file:", fileError);
      }

      await Certificate.findOneAndDelete({ certificateId });

      res.status(200).json({
        success: true,
        message: "Certificate deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting certificate:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete certificate",
        error: error.message,
      });
    }
  }

  /**
   * Get certificate statistics
   * GET /api/certificates/stats
   */
  async getCertificateStats(req, res) {
    try {
      const stats = await Certificate.aggregate([
        {
          $group: {
            _id: null,
            totalCertificates: { $sum: 1 },
            certificatesByType: { $push: "$certificateType" },
          },
        },
        {
          $project: {
            totalCertificates: 1,
            certificatesByType: {
              $map: {
                input: { $setUnion: ["$certificatesByType"] },
                as: "type",
                in: {
                  type: "$$type",
                  count: {
                    $size: {
                      $filter: {
                        input: "$certificatesByType",
                        cond: { $eq: ["$$this", "$$type"] },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      ]);

      const emailStats = await Certificate.aggregate([
        { $match: { isEmailSent: true } },
        { $group: { _id: null, totalEmailsSent: { $sum: 1 } } },
      ]);

      res.status(200).json({
        success: true,
        data: {
          totalCertificates: stats[0]?.totalCertificates || 0,
          certificatesByType: stats[0]?.certificatesByType || [],
          totalEmailsSent: emailStats[0]?.totalEmailsSent || 0,
        },
      });
    } catch (error) {
      console.error("Error fetching certificate stats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch certificate statistics",
        error: error.message,
      });
    }
  }

  /**
   * Update certificate
   * PUT /api/certificates/:certificateId
   */
  async updateCertificate(req, res) {
    try {
      const { certificateId } = req.params;
      const { templateId, studentName, customMessage, sendEmail } = req.body;

      const certificate = await Certificate.findOneAndUpdate(
        { certificateId },
        { templateId, studentName, customMessage, sendEmail },
        { new: true }
      );

      if (!certificate) {
        return res.status(404).json({
          success: false,
          message: 'Certificate not found',
        });
      }

      res.status(200).json({
        success: true,
        message: 'Certificate updated successfully',
        data: { certificate },
      });
    } catch (error) {
      console.error('Error updating certificate:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update certificate',
        error: error.message,
      });
    }
  }

  /**
   * Update form certificate customizations
   * PUT /api/certificates/customizations/:formId
   */
  async updateFormCustomizations(req, res) {
    try {
      const { formId } = req.params;
      const customizations = req.body;

      // Validate that the user owns the form
      const Form = require("../../models/Form");
      const form = await Form.findOne({ _id: formId, createdBy: req.user._id });

      if (!form) {
        return res.status(404).json({
          success: false,
          message: 'Form not found or you do not have permission to update it',
        });
      }

      // Update the certificate customizations
      form.certificateCustomizations = {
        ...form.certificateCustomizations,
        ...customizations,
      };

      await form.save();

      res.status(200).json({
        success: true,
        message: 'Certificate customizations updated successfully',
        data: { customizations: form.certificateCustomizations },
      });
    } catch (error) {
      console.error('Error updating form customizations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update certificate customizations',
        error: error.message,
      });
    }
  }

  /**
   * Get form certificate customizations
   * GET /api/certificates/customizations/:formId
   */
  async getFormCustomizations(req, res) {
    try {
      const { formId } = req.params;

      // Validate that the user owns the form
      const Form = require("../../models/Form");
      const form = await Form.findOne({ _id: formId, createdBy: req.user._id });

      if (!form) {
        return res.status(404).json({
          success: false,
          message: 'Form not found or you do not have permission to view it',
        });
      }

      res.status(200).json({
        success: true,
        data: { customizations: form.certificateCustomizations || {} },
      });
    } catch (error) {
      console.error('Error fetching form customizations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch certificate customizations',
        error: error.message,
      });
    }
  }
}

module.exports = new CertificateController();
