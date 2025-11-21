const googleFormsService = require('../../services/googleForms/googleFormsService');

/**
 * Controller for Google Forms operations
 */
class GoogleFormsController {
  /**
   * Extract questions and sections from a Google Form URL
   * @route POST /api/google-forms/extract
   */
  async extractFormQuestions(req, res) {
    try {
      const { formUrl } = req.body;

      // Validate input
      if (!formUrl) {
        return res.status(400).json({
          success: false,
          error: 'Form URL is required'
        });
      }

      // Validate URL format
      if (!googleFormsService.isValidGoogleFormUrl(formUrl)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Google Form URL. Please provide a valid Google Forms link.'
        });
      }

      // Extract form questions and sections
      const result = await googleFormsService.extractFormQuestions(formUrl);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error || 'Failed to extract form questions'
        });
      }

      // Return the extracted data
      return res.status(200).json({
        success: true,
        message: 'Form questions extracted successfully',
        data: result.data
      });

    } catch (error) {
      console.error('Error in extractFormQuestions controller:', error);
      return res.status(500).json({
        success: false,
        error: 'An unexpected error occurred while extracting form questions'
      });
    }
  }

  /**
   * Validate a Google Form URL
   * @route POST /api/google-forms/validate
   */
  async validateFormUrl(req, res) {
    try {
      const { formUrl } = req.body;

      if (!formUrl) {
        return res.status(400).json({
          success: false,
          error: 'Form URL is required',
          isValid: false
        });
      }

      const isValid = googleFormsService.isValidGoogleFormUrl(formUrl);
      const convertedUrl = isValid ? googleFormsService.convertToViewformUrl(formUrl) : null;

      return res.status(200).json({
        success: true,
        isValid,
        originalUrl: formUrl,
        viewformUrl: convertedUrl,
        message: isValid ? 'Valid Google Form URL' : 'Invalid Google Form URL'
      });

    } catch (error) {
      console.error('Error in validateFormUrl controller:', error);
      return res.status(500).json({
        success: false,
        error: 'An unexpected error occurred while validating the form URL',
        isValid: false
      });
    }
  }

  /**
   * Extract form questions and save them to an event
   * @route POST /api/google-forms/extract-and-save
   */
  async extractAndSaveToEvent(req, res) {
    try {
      const { formUrl, eventId } = req.body;

      // Validate input
      if (!formUrl || !eventId) {
        return res.status(400).json({
          success: false,
          error: 'Form URL and Event ID are required'
        });
      }

      // Validate URL format
      if (!googleFormsService.isValidGoogleFormUrl(formUrl)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Google Form URL'
        });
      }

      // Extract form questions
      const result = await googleFormsService.extractFormQuestions(formUrl);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error || 'Failed to extract form questions'
        });
      }

      // Here you would typically save the extracted data to your database
      // For now, we'll just return the extracted data with the event ID
      const Event = require('../../models/Event');
      
      // Check if event exists
      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({
          success: false,
          error: 'Event not found'
        });
      }

      // You could extend the Event model to include survey data
      // For this implementation, we'll return the combined data
      const responseData = {
        eventId: eventId,
        eventName: event.name,
        formUrl: formUrl,
        extractedData: result.data,
        extractedAt: new Date()
      };

      return res.status(200).json({
        success: true,
        message: 'Form questions extracted and associated with event successfully',
        data: responseData
      });

    } catch (error) {
      console.error('Error in extractAndSaveToEvent controller:', error);
      return res.status(500).json({
        success: false,
        error: 'An unexpected error occurred while processing the request'
      });
    }
  }

  /**
   * Get sample Google Form URLs for testing
   * @route GET /api/google-forms/samples
   */
  async getSampleForms(req, res) {
    try {
      const sampleForms = [
        {
          title: 'Event Feedback Form',
          url: 'https://forms.google.com/forms/d/1FAIpQLSc_example1/viewform',
          description: 'Sample event feedback form'
        },
        {
          title: 'Registration Form',
          url: 'https://forms.gle/exampleShortUrl',
          description: 'Sample registration form with short URL'
        },
        {
          title: 'Survey Form',
          url: 'https://docs.google.com/forms/d/e/1FAIpQLSc_example2/viewform',
          description: 'Sample survey form with various question types'
        }
      ];

      return res.status(200).json({
        success: true,
        message: 'Sample Google Form URLs retrieved',
        data: sampleForms,
        note: 'These are example URLs. Replace with actual Google Form URLs for testing.'
      });

    } catch (error) {
      console.error('Error in getSampleForms controller:', error);
      return res.status(500).json({
        success: false,
        error: 'An unexpected error occurred'
      });
    }
  }

  /**
   * Extract questions from multiple Google Forms
   * @route POST /api/google-forms/extract-batch
   */
  async extractBatchForms(req, res) {
    try {
      const { formUrls } = req.body;

      // Validate input
      if (!formUrls || !Array.isArray(formUrls) || formUrls.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'An array of form URLs is required'
        });
      }

      // Limit batch size to prevent overload
      if (formUrls.length > 10) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 10 forms can be processed at once'
        });
      }

      // Process each form URL
      const results = [];
      const errors = [];

      for (let i = 0; i < formUrls.length; i++) {
        const formUrl = formUrls[i];
        
        try {
          // Validate URL
          if (!googleFormsService.isValidGoogleFormUrl(formUrl)) {
            errors.push({
              index: i,
              url: formUrl,
              error: 'Invalid Google Form URL'
            });
            continue;
          }

          // Extract form data
          const result = await googleFormsService.extractFormQuestions(formUrl);
          
          if (result.success) {
            results.push({
              index: i,
              url: formUrl,
              data: result.data
            });
          } else {
            errors.push({
              index: i,
              url: formUrl,
              error: result.error
            });
          }
        } catch (error) {
          errors.push({
            index: i,
            url: formUrl,
            error: error.message || 'Extraction failed'
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: `Processed ${formUrls.length} forms`,
        summary: {
          total: formUrls.length,
          successful: results.length,
          failed: errors.length
        },
        results,
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error) {
      console.error('Error in extractBatchForms controller:', error);
      return res.status(500).json({
        success: false,
        error: 'An unexpected error occurred while processing batch extraction'
      });
    }
  }
}

module.exports = new GoogleFormsController();