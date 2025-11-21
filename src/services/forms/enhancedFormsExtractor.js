/**
 * Enhanced Google Forms Extractor
 *
 * This module wraps the existing formsService.extractDataFromUrl method
 * and enhances it with Puppeteer-based extraction as the primary method,
 * falling back to the existing axios/cheerio scraping if Puppeteer fails.
 *
 * Usage in formsController.js:
 *   Replace:
 *     const extractedData = await formsService.extractDataFromUrl({ url, createdBy });
 *   With:
 *     const extractedData = await enhancedFormsExtractor.extractDataFromUrl({ url, createdBy });
 */

const puppeteerExtractor = require("./googleFormsExtractorPuppeteer");
const formsService = require("./formsService");

class EnhancedFormsExtractor {
  /**
   * Extract form data from Google Forms URL
   * Uses Puppeteer first, falls back to axios/cheerio if that fails
   *
   * @param {Object} params - Parameters
   * @param {string} params.url - Google Forms URL
   * @param {string} params.createdBy - User ID who is creating the form
   * @returns {Promise<Object>} Extracted form data
   */
  async extractDataFromUrl({ url, createdBy }) {
    console.log(
      `\n🔍 [Enhanced Extractor] Starting extraction for URL: ${url}\n`
    );

    // Strategy 1: Try Puppeteer extraction (most reliable)
    try {
      console.log(
        `🚀 [Enhanced Extractor] Strategy 1: Attempting Puppeteer extraction...`
      );

      const puppeteerData = await puppeteerExtractor.extractForm(url);

      if (
        puppeteerData &&
        puppeteerData.questions &&
        puppeteerData.questions.length > 0
      ) {
        console.log(`✅ [Enhanced Extractor] Puppeteer extraction successful!`);
        console.log(`   Title: ${puppeteerData.title}`);
        console.log(`   Description: ${puppeteerData.description}`);
        console.log(`   Questions found: ${puppeteerData.questions.length}\n`);

        // Extract form ID from URL for tracking
        let formId;
        let finalUrl = url;

        // Handle shortened URLs
        if (url.includes("forms.gle")) {
          const axios = require("axios");
          try {
            const response = await axios.head(url, { maxRedirects: 5 });
            finalUrl = response.request.res.responseUrl;
          } catch (error) {
            console.warn(
              "⚠️ [Enhanced Extractor] Could not resolve shortened URL, using original"
            );
          }
        }

        // Extract form ID
        let formIdMatch = finalUrl.match(/\/forms\/d\/e\/([a-zA-Z0-9-_]+)/);
        if (!formIdMatch) {
          formIdMatch = finalUrl.match(/\/forms\/d\/([a-zA-Z0-9-_]+)/);
        }
        if (!formIdMatch) {
          formIdMatch = finalUrl.match(
            /docs\.google\.com\/forms\/d\/([a-zA-Z0-9-_]+)/
          );
        }
        if (!formIdMatch) {
          formIdMatch = finalUrl.match(/([a-zA-Z0-9-_]{20,})/);
        }

        formId = formIdMatch ? formIdMatch[1] : "unknown";

        // Check for duplicate form
        const Form = require("../../models/Form");
        const existingForm = await Form.findOne({ googleFormId: formId });
        if (existingForm) {
          throw new Error("This Google Form has already been imported");
        }

        // Return Puppeteer-extracted data in the expected format
        return {
          title: puppeteerData.title || "Imported Google Form",
          description:
            puppeteerData.description || "Form imported from Google Forms",
          questions: puppeteerData.questions,
          googleFormId: formId,
          uploadedLinks: [
            {
              title: "Original Google Form",
              url: finalUrl,
              description: "Link to the original Google Form",
              uploadedAt: new Date(),
            },
          ],
        };
      } else {
        console.log(
          `⚠️ [Enhanced Extractor] Puppeteer extracted 0 questions, falling back...`
        );
      }
    } catch (puppeteerError) {
      console.error(
        `❌ [Enhanced Extractor] Puppeteer extraction failed: ${puppeteerError.message}`
      );
      if (
        puppeteerError.message === "This Google Form has already been imported"
      ) {
        throw puppeteerError; // Re-throw duplicate error
      }
      console.log(
        `🔄 [Enhanced Extractor] Falling back to original axios/cheerio method...\n`
      );
    }

    // Strategy 2: Fallback to original formsService method
    try {
      console.log(
        `🔍 [Enhanced Extractor] Strategy 2: Using original axios/cheerio extraction...`
      );
      const originalData = await formsService.extractDataFromUrl({
        url,
        createdBy,
      });

      console.log(`✅ [Enhanced Extractor] Axios/Cheerio extraction completed`);
      console.log(
        `   Questions found: ${
          originalData.questions ? originalData.questions.length : 0
        }\n`
      );

      return originalData;
    } catch (originalError) {
      console.error(`❌ [Enhanced Extractor] Both extraction methods failed`);
      throw originalError;
    }
  }
}

module.exports = new EnhancedFormsExtractor();
