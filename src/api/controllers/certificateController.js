const certificateService = require('../../services/certificate/certificateService');
const Certificate = require('../../models/Certificate');
const fs = require('fs');
const path = require('path');

class CertificateController {
  /**
   * Generate a single certificate
   * POST /api/certificates/generate
   */
  async generateCertificate(req, res) {
    try {
      // Validate that req.body exists
      if (!req.body) {
        return res.status(400).json({
          success: false,
          message: 'Request body is required',
        });
      }

      const { userId, eventId, certificateType, customMessage, sendEmail } = req.body;

      if (!userId || !eventId) {
        return res.status(400).json({
          success: false,
          message: 'User ID and Event ID are required',
        });
      }

      const options = {
        certificateType: certificateType || 'participation',
        customMessage,
        sendEmail: sendEmail !== false, // Default to true
      };

      const result = await certificateService.generateCertificate(userId, eventId, options);

      res.status(201).json({
        success: true,
        message: 'Certificate generated successfully',
        data: result,
      });

    } catch (error) {
      console.error('Error generating certificate:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate certificate',
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
      // Validate that req.body exists
      if (!req.body) {
        return res.status(400).json({
          success: false,
          message: 'Request body is required',
        });
      }

      const { eventId, participantIds, certificateType, customMessage, sendEmail } = req.body;

      if (!eventId || !participantIds || !Array.isArray(participantIds)) {
        return res.status(400).json({
          success: false,
          message: 'Event ID and participant IDs array are required',
        });
      }

      const options = {
        certificateType: certificateType || 'participation',
        customMessage,
        sendEmail: sendEmail !== false,
      };

      const results = await certificateService.generateBulkCertificates(eventId, participantIds, options);

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      res.status(200).json({
        success: true,
        message: `Processed ${results.length} certificates. ${successCount} successful, ${failureCount} failed`,
        data: results,
      });

    } catch (error) {
      console.error('Error generating bulk certificates:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate bulk certificates',
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

      const certificate = await certificateService.getCertificate(certificateId);

      res.status(200).json({
        success: true,
        data: certificate,
      });

    } catch (error) {
      console.error('Error fetching certificate:', error);

      if (error.message === 'Certificate not found') {
        return res.status(404).json({
          success: false,
          message: 'Certificate not found',
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to fetch certificate',
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
          message: 'Certificate not found',
        });
      }

      if (!fs.existsSync(certificate.filePath)) {
        return res.status(404).json({
          success: false,
          message: 'Certificate file not found',
        });
      }

      // Set appropriate headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${certificate.certificateId}.pdf"`);

      // Stream the file
      const fileStream = fs.createReadStream(certificate.filePath);
      fileStream.pipe(res);

    } catch (error) {
      console.error('Error downloading certificate:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to download certificate',
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

      const certificates = await Certificate.find({ userId })
        .populate('eventId', 'name date')
        .sort({ issuedDate: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Certificate.countDocuments({ userId });

      res.status(200).json({
        success: true,
        data: certificates,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalCertificates: total,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1,
        },
      });

    } catch (error) {
      console.error('Error fetching user certificates:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user certificates',
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

      const certificates = await Certificate.find({ eventId })
        .populate('userId', 'name email')
        .sort({ issuedDate: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Certificate.countDocuments({ eventId });

      res.status(200).json({
        success: true,
        data: certificates,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalCertificates: total,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1,
        },
      });

    } catch (error) {
      console.error('Error fetching event certificates:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch event certificates',
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
        .populate('userId', 'name email')
        .populate('eventId', 'name date');

      if (!certificate) {
        return res.status(404).json({
          success: false,
          message: 'Certificate not found',
        });
      }

      if (!fs.existsSync(certificate.filePath)) {
        return res.status(404).json({
          success: false,
          message: 'Certificate file not found',
        });
      }

      const certificateData = {
        user: certificate.userId,
        event: certificate.eventId,
        certificateId: certificate.certificateId,
        certificateType: certificate.certificateType,
        customMessage: certificate.customMessage,
      };

      await certificateService.sendCertificateByEmail(certificateData, certificate.filePath);

      res.status(200).json({
        success: true,
        message: 'Certificate email sent successfully',
      });

    } catch (error) {
      console.error('Error resending certificate:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resend certificate',
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
          message: 'Certificate not found',
        });
      }

      // Delete the PDF file
      if (fs.existsSync(certificate.filePath)) {
        fs.unlinkSync(certificate.filePath);
      }

      // Delete the database record
      await Certificate.findOneAndDelete({ certificateId });

      res.status(200).json({
        success: true,
        message: 'Certificate deleted successfully',
      });

    } catch (error) {
      console.error('Error deleting certificate:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete certificate',
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
            certificatesByType: {
              $push: '$certificateType',
            },
            certificatesByMonth: {
              $push: {
                month: { $month: '$issuedDate' },
                year: { $year: '$issuedDate' },
              },
            },
          },
        },
        {
          $project: {
            totalCertificates: 1,
            certificatesByType: {
              $map: {
                input: {
                  $setUnion: ['$certificatesByType'],
                },
                as: 'type',
                in: {
                  type: '$$type',
                  count: {
                    $size: {
                      $filter: {
                        input: '$certificatesByType',
                        cond: { $eq: ['$$this', '$$type'] },
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
        {
          $match: { isEmailSent: true },
        },
        {
          $group: {
            _id: null,
            totalEmailsSent: { $sum: 1 },
          },
        },
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
      console.error('Error fetching certificate stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch certificate statistics',
        error: error.message,
      });
    }
  }
}

module.exports = new CertificateController();