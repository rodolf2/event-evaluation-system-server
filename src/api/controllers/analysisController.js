const mongoose = require('mongoose');
const analysisService = require('../../services/analysis/analysisService');

/**
 * Handles the request to get the average rating for an event.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 */
const getAverageRatingForEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }

    const eventObjectId = new mongoose.Types.ObjectId(eventId);
    const averageRating = await analysisService.getAverageRating(eventObjectId);

    res.status(200).json({ eventId, averageRating });
  } catch (error) {
    res.status(500).json({ message: 'Error getting average rating', error: error.message });
  }
};

const getQualitativeReportForEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }

    const eventObjectId = new mongoose.Types.ObjectId(eventId);
    const report = await analysisService.generateQualitativeReport(eventObjectId);

    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({ message: 'Error generating qualitative report', error: error.message });
  }
};

const getQuantitativeReportForEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: 'Invalid event ID' });
    }

    const report = await analysisService.generateQuantitativeReport(eventId);

    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({ message: 'Error generating quantitative report', error: error.message });
  }
};

module.exports = {
  getAverageRatingForEvent,
  getQualitativeReportForEvent,
  getQuantitativeReportForEvent,
};
