const axios = require('axios');
const cheerio = require('cheerio');

class GoogleFormsService {
  /**
   * Extracts questions and sections from a Google Form URL
   * @param {string} formUrl - The Google Form URL
   * @returns {Object} - Extracted form data including title, description, sections, and questions
   */
  async extractFormQuestions(formUrl) {
    try {
      // Validate the URL
      if (!this.isValidGoogleFormUrl(formUrl)) {
        throw new Error('Invalid Google Form URL');
      }

      // Convert the form URL to viewform if it's not already
      const viewformUrl = this.convertToViewformUrl(formUrl);

      // Fetch the form HTML
      const response = await axios.get(viewformUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      // Parse the HTML
      const $ = cheerio.load(response.data);

      // Extract form metadata
      const formData = {
        title: '',
        description: '',
        sections: [],
        questions: [],
        totalQuestions: 0
      };

      // Try to extract form title and description
      formData.title = this.extractFormTitle($);
      formData.description = this.extractFormDescription($);

      // Extract sections and questions
      const extractedData = this.extractSectionsAndQuestions($);
      formData.sections = extractedData.sections;
      formData.questions = extractedData.questions;
      formData.totalQuestions = extractedData.questions.length;

      return {
        success: true,
        data: formData
      };

    } catch (error) {
      console.error('Error extracting Google Form:', error);
      return {
        success: false,
        error: error.message || 'Failed to extract Google Form questions'
      };
    }
  }

  /**
   * Validates if the URL is a Google Form URL
   * @param {string} url - URL to validate
   * @returns {boolean}
   */
  isValidGoogleFormUrl(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }

    const googleFormPatterns = [
      /^https?:\/\/(docs|forms)\.google\.com\/forms\//i,
      /^https?:\/\/forms\.gle\//i
    ];

    return googleFormPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Converts various Google Form URL formats to viewform URL
   * @param {string} url - Google Form URL
   * @returns {string} - Viewform URL
   */
  convertToViewformUrl(url) {
    // Handle forms.gle short URLs
    if (url.includes('forms.gle')) {
      // These URLs redirect, we'll handle them as-is
      return url;
    }

    // Extract form ID from various URL formats
    let formId = null;
    
    // Pattern for standard Google Forms URLs - order matters!
    const patterns = [
      /\/forms\/d\/e\/([a-zA-Z0-9-_]+)/,  // Check for /d/e/ pattern first
      /\/forms\/d\/([a-zA-Z0-9-_]+)/,     // Then check for /d/ pattern
      /formResponse.*[?&]formkey=([a-zA-Z0-9-_]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        formId = match[1];
        break;
      }
    }

    if (formId) {
      return `https://docs.google.com/forms/d/${formId}/viewform`;
    }

    // If no pattern matches, return the original URL
    return url;
  }

  /**
   * Extracts the form title from the HTML
   * @param {CheerioStatic} $ - Cheerio instance
   * @returns {string}
   */
  extractFormTitle($) {
    // Try multiple selectors for form title
    const titleSelectors = [
      'div[role="heading"][aria-level="1"]',
      '.freebirdFormviewerViewHeaderTitle',
      'h1[role="heading"]',
      'div.freebirdFormviewerComponentsQuestionBaseTitle',
      'meta[property="og:title"]'
    ];

    for (const selector of titleSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        if (selector.includes('meta')) {
          return element.attr('content') || 'Untitled Form';
        }
        return element.first().text().trim() || 'Untitled Form';
      }
    }

    return 'Untitled Form';
  }

  /**
   * Extracts the form description from the HTML
   * @param {CheerioStatic} $ - Cheerio instance
   * @returns {string}
   */
  extractFormDescription($) {
    // Try multiple selectors for form description
    const descriptionSelectors = [
      '.freebirdFormviewerViewHeaderDescription',
      'div[role="heading"][aria-level="1"] + div',
      'meta[property="og:description"]'
    ];

    for (const selector of descriptionSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        if (selector.includes('meta')) {
          return element.attr('content') || '';
        }
        const text = element.first().text().trim();
        if (text && text !== 'Required' && !text.includes('*')) {
          return text;
        }
      }
    }

    return '';
  }

  /**
   * Extracts sections and questions from the form HTML
   * @param {CheerioStatic} $ - Cheerio instance
   * @returns {Object} - Object containing sections and questions arrays
   */
  extractSectionsAndQuestions($) {
    const sections = [];
    const questions = [];
    let currentSection = {
      title: 'Main Section',
      description: '',
      questions: []
    };

    // Find all question containers
    const questionContainers = $('div[role="listitem"], .freebirdFormviewerComponentsQuestionBaseRoot');

    questionContainers.each((index, element) => {
      const $element = $(element);
      
      // Check if this is a section header
      const sectionTitle = $element.find('.freebirdFormviewerComponentsQuestionSectionTitle').text().trim();
      
      if (sectionTitle) {
        // Save current section if it has questions
        if (currentSection.questions.length > 0) {
          sections.push(currentSection);
        }
        
        // Start new section
        currentSection = {
          title: sectionTitle,
          description: $element.find('.freebirdFormviewerComponentsQuestionSectionDescription').text().trim() || '',
          questions: []
        };
      } else {
        // Extract question
        const question = this.extractQuestion($element, $);
        
        if (question) {
          questions.push(question);
          currentSection.questions.push(question);
        }
      }
    });

    // Add the last section if it has questions
    if (currentSection.questions.length > 0) {
      sections.push(currentSection);
    }

    // If no sections were found, create a default section with all questions
    if (sections.length === 0 && questions.length > 0) {
      sections.push({
        title: 'Main Section',
        description: '',
        questions: questions
      });
    }

    return { sections, questions };
  }

  /**
   * Extracts a single question from an element
   * @param {CheerioElement} element - The question element
   * @param {CheerioStatic} $ - Cheerio instance
   * @returns {Object|null} - Question object or null
   */
  extractQuestion(element, $) {
    const $element = $(element);
    
    // Find question text
    const questionTextSelectors = [
      '.freebirdFormviewerComponentsQuestionBaseTitle',
      'div[role="heading"]',
      'span[role="heading"]',
      '.freebirdFormviewerViewItemsItemItemTitle'
    ];

    let questionText = '';
    for (const selector of questionTextSelectors) {
      const textElement = $element.find(selector).first();
      if (textElement.length > 0) {
        questionText = textElement.text().trim();
        if (questionText) break;
      }
    }

    if (!questionText) {
      return null;
    }

    // Determine if question is required
    const isRequired = $element.find('span[aria-label="Required question"]').length > 0 ||
                      $element.find('.freebirdFormviewerComponentsQuestionBaseRequiredAsterisk').length > 0 ||
                      questionText.includes('*');

    // Clean question text (remove asterisk if present)
    questionText = questionText.replace(/\*$/, '').trim();

    // Determine question type
    const questionType = this.determineQuestionType($element, $);

    // Extract options for multiple choice or checkbox questions
    const options = this.extractOptions($element, $, questionType);

    return {
      text: questionText,
      type: questionType,
      required: isRequired,
      options: options
    };
  }

  /**
   * Determines the type of question
   * @param {CheerioElement} element - The question element
   * @param {CheerioStatic} $ - Cheerio instance
   * @returns {string} - Question type
   */
  determineQuestionType(element, $) {
    const $element = $(element);

    // Check for different input types
    if ($element.find('input[type="text"]').length > 0) {
      if ($element.find('input[aria-label*="Short answer"]').length > 0) {
        return 'short_answer';
      }
      return 'text';
    }

    if ($element.find('textarea').length > 0) {
      return 'paragraph';
    }

    if ($element.find('div[role="radiogroup"]').length > 0 || 
        $element.find('input[type="radio"]').length > 0) {
      return 'multiple_choice';
    }

    if ($element.find('div[role="group"][aria-label*="Checkboxes"]').length > 0 ||
        $element.find('input[type="checkbox"]').length > 0) {
      return 'checkbox';
    }

    if ($element.find('div[role="listbox"]').length > 0 ||
        $element.find('select').length > 0) {
      return 'dropdown';
    }

    if ($element.find('input[type="date"]').length > 0 ||
        $element.find('input[aria-label*="Date"]').length > 0) {
      return 'date';
    }

    if ($element.find('input[type="time"]').length > 0 ||
        $element.find('input[aria-label*="Time"]').length > 0) {
      return 'time';
    }

    // Check for scale/linear scale
    if ($element.find('div[role="radiogroup"] label').text().match(/^\d+$/)) {
      return 'linear_scale';
    }

    // Check for grid questions
    if ($element.find('div[role="group"] div[role="radiogroup"]').length > 1 ||
        $element.find('table').length > 0) {
      return 'grid';
    }

    return 'unknown';
  }

  /**
   * Extracts options for multiple choice or checkbox questions
   * @param {CheerioElement} element - The question element
   * @param {CheerioStatic} $ - Cheerio instance
   * @param {string} questionType - Type of the question
   * @returns {Array} - Array of options
   */
  extractOptions(element, $, questionType) {
    const $element = $(element);
    const options = [];

    if (questionType === 'multiple_choice' || questionType === 'checkbox') {
      // Find option labels
      const optionSelectors = [
        'label span.docssharedWizToggleLabeledContent',
        'div[role="radio"] span',
        'div[role="checkbox"] span',
        'label[for]',
        '.freebirdFormviewerComponentsQuestionRadioChoice',
        '.freebirdFormviewerComponentsQuestionCheckboxChoice'
      ];

      for (const selector of optionSelectors) {
        const optionElements = $element.find(selector);
        if (optionElements.length > 0) {
          optionElements.each((i, opt) => {
            const optionText = $(opt).text().trim();
            if (optionText && !options.includes(optionText)) {
              options.push(optionText);
            }
          });
          if (options.length > 0) break;
        }
      }
    } else if (questionType === 'dropdown') {
      // Extract dropdown options
      $element.find('option').each((i, opt) => {
        const optionText = $(opt).text().trim();
        if (optionText && optionText !== 'Choose') {
          options.push(optionText);
        }
      });
    } else if (questionType === 'linear_scale') {
      // Extract scale range
      const labels = $element.find('label').map((i, el) => $(el).text().trim()).get();
      const numbers = labels.filter(label => /^\d+$/.test(label));
      if (numbers.length >= 2) {
        const min = Math.min(...numbers.map(Number));
        const max = Math.max(...numbers.map(Number));
        for (let i = min; i <= max; i++) {
          options.push(i.toString());
        }
      }
    }

    return options;
  }

  /**
   * Fetches and parses a Google Form using an alternative method (for forms.gle URLs)
   * @param {string} shortUrl - The forms.gle URL
   * @returns {Object} - Extracted form data
   */
  async extractFromShortUrl(shortUrl) {
    try {
      // Follow the redirect to get the actual form URL
      const response = await axios.get(shortUrl, {
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      // The response URL should be the full form URL
      const fullUrl = response.request.res.responseUrl || response.request.path;
      
      if (fullUrl && fullUrl !== shortUrl) {
        // Recursively call the main extraction method with the full URL
        return await this.extractFormQuestions(fullUrl);
      }

      // If we couldn't get the full URL, try parsing the response directly
      const $ = cheerio.load(response.data);
      const extractedData = this.extractSectionsAndQuestions($);
      
      return {
        success: true,
        data: {
          title: this.extractFormTitle($),
          description: this.extractFormDescription($),
          sections: extractedData.sections,
          questions: extractedData.questions,
          totalQuestions: extractedData.questions.length
        }
      };

    } catch (error) {
      console.error('Error extracting from short URL:', error);
      throw error;
    }
  }
}

module.exports = new GoogleFormsService();