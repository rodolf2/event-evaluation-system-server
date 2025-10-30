const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Test web scraping extraction from Google Forms
 */
async function testWebScrapingExtraction() {
  console.log('🕷️ Testing Web Scraping Extraction...\n');

  const testUrl = "https://docs.google.com/forms/d/e/1FAIpQLSfWXoJbAhj_1cjzrWTjGyhIIkY-HB22ay1rdyQMqJRk4PcURw/viewform?usp=dialog";

  try {
    console.log('1️⃣ Fetching Google Form HTML...');

    const response = await axios.get(testUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      },
      maxRedirects: 5
    });

    const html = response.data;
    console.log('✅ Successfully fetched HTML, length:', html.length);

    console.log('2️⃣ Extracting with Cheerio web scraping...');

    const $ = cheerio.load(html);
    let extractedQuestions = [];

    // Look for question containers - Google Forms uses specific class names
    const questionSelectors = [
      '.freebirdFormviewerComponentsQuestionBaseRoot',
      '[data-item-id]',
      '.freebirdFormviewerViewItemsItemItem',
      '[jsname="ibnC6b"]',
      '.question'
    ];

    let questionElements = [];

    // Try different selectors to find question containers
    for (const selector of questionSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`Found ${elements.length} questions using selector: ${selector}`);
        questionElements = elements;
        break;
      }
    }

    // If no specific containers found, try to find question text directly
    if (questionElements.length === 0) {
      console.log('No specific question containers found, trying text analysis...');

      // Look for common question patterns in the HTML
      const questionTexts = [];

      // Extract text that looks like questions
      $('div, span, p').each((i, elem) => {
        const text = $(elem).text().trim();
        if (text.length > 5 && text.length < 300 &&
            !text.includes('http') &&
            !text.includes('@') &&
            !text.match(/^(event|contact|timing|address)/i) &&
            text.includes('?')) {
          questionTexts.push(text);
        }
      });

      // Convert found texts to questions
      questionTexts.forEach((text, index) => {
        extractedQuestions.push({
          title: text,
          type: "short_answer",
          required: false,
          options: [],
          low: 1,
          high: 5,
          lowLabel: "Poor",
          highLabel: "Excellent"
        });
      });

      console.log(`Found ${extractedQuestions.length} questions by text analysis`);
    } else {
      // Process found question elements
      questionElements.each((index, element) => {
        try {
          const $elem = $(element);

          // Extract question text
          let questionText = '';
          const textSelectors = [
            '.freebirdFormviewerComponentsQuestionBaseTitle',
            '[jsname="V67aGc"]',
            '.exportContent',
            'span',
            'div'
          ];

          for (const textSel of textSelectors) {
            const textElem = $elem.find(textSel).first();
            if (textElem.length > 0) {
              questionText = textElem.text().trim();
              if (questionText) break;
            }
          }

          // Skip if no question text found
          if (!questionText || questionText.length < 3) {
            return;
          }

          // Determine question type
          let questionType = 'short_answer';
          let options = [];

          // Check for multiple choice indicators
          const hasRadioButtons = $elem.find('input[type="radio"]').length > 0;
          const hasCheckboxes = $elem.find('input[type="checkbox"]').length > 0;
          const hasSelect = $elem.find('select').length > 0;
          const hasTextarea = $elem.find('textarea').length > 0;
          const hasScale = $elem.find('.freebirdFormviewerComponentsQuestionScaleSlider').length > 0;

          if (hasRadioButtons || hasSelect) {
            questionType = 'multiple_choice';
            // Extract options
            $elem.find('label, .freebirdFormviewerComponentsQuestionRadioChoice, option').each((i, opt) => {
              const optText = $(opt).text().trim();
              if (optText && optText !== questionText && optText.length > 0) {
                options.push(optText);
              }
            });
          } else if (hasCheckboxes) {
            questionType = 'multiple_choice';
            // Extract options for checkboxes
            $elem.find('label, .freebirdFormviewerComponentsQuestionCheckboxChoice').each((i, opt) => {
              const optText = $(opt).text().trim();
              if (optText && optText !== questionText && optText.length > 0) {
                options.push(optText);
              }
            });
          } else if (hasTextarea) {
            questionType = 'paragraph';
          } else if (hasScale) {
            questionType = 'scale';
          }

          // Check if required (look for asterisk or required indicators)
          const isRequired = $elem.text().includes('*') ||
                           $elem.find('.freebirdFormviewerComponentsQuestionBaseRequiredAsterisk').length > 0 ||
                           $elem.closest('[aria-required="true"]').length > 0;

          extractedQuestions.push({
            title: questionText,
            type: questionType,
            required: isRequired,
            options: options,
            low: 1,
            high: 5,
            lowLabel: "Poor",
            highLabel: "Excellent"
          });

        } catch (elemError) {
          console.log(`Error processing question element ${index}:`, elemError.message);
        }
      });

      console.log(`Successfully extracted ${extractedQuestions.length} questions using web scraping`);
    }

    console.log('\n📊 Results:');
    console.log(`Total questions extracted: ${extractedQuestions.length}`);

    if (extractedQuestions.length > 0) {
      console.log('\n📝 Questions:');
      extractedQuestions.forEach((q, i) => {
        console.log(`${i + 1}. ${q.title}`);
        console.log(`   Type: ${q.type}, Required: ${q.required}`);
        if (q.options && q.options.length > 0) {
          console.log(`   Options: ${q.options.join(', ')}`);
        }
        console.log('');
      });
    }

  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

// Run the test
if (require.main === module) {
  testWebScrapingExtraction();
}

module.exports = { testWebScrapingExtraction };