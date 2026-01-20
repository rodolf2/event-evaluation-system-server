const puppeteer = require("puppeteer");

/**
 * Google Forms Extractor using Puppeteer
 *
 * This service uses browser automation to extract form data from Google Forms.
 * It's more reliable than static HTML scraping because it:
 * - Renders JavaScript like a real browser
 * - Can access runtime variables (window.FB_PUBLIC_LOAD_DATA)
 * - Handles dynamic content loading
 * - Less affected by HTML structure changes
 * - Supports multi-page forms by navigating through all pages
 */
class GoogleFormsExtractorPuppeteer {
  /**
   * Helper function to wait for a specified duration
   * @param {number} ms - Milliseconds to wait
   */
  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Extract form data from a Google Forms URL
   * @param {string} url - The Google Forms URL
   * @returns {Promise<Object>} Extracted form data
   */
  async extractForm(url) {
    console.log(`\n🔍 [Puppeteer Extractor] Starting extraction for: ${url}`);

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
    });

    try {
      const page = await browser.newPage();

      // Set a realistic viewport
      await page.setViewport({ width: 1920, height: 1080 });

      // Set user agent to look like a real browser
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );

      // Optimize: Block unnecessary resources
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        const resourceType = req.resourceType();
        if (
          ["image", "stylesheet", "font", "media", "other"].includes(
            resourceType
          )
        ) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Navigate and wait for network to be idle to ensure all scripts are loaded
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Wait a bit for any dynamic content to load
      await this.delay(1000);

      // Extract form data from the page using FB_PUBLIC_LOAD_DATA
      const formData = await this.extractFromFBData(page);

      // If FB_PUBLIC_LOAD_DATA extraction yields results, return them
      if (formData.questions.length > 0) {
        console.log(
          `✅ [Puppeteer Extractor] Extracted ${formData.questions.length} questions from FB_PUBLIC_LOAD_DATA`
        );
        return formData;
      }

      // Fallback: Extract from DOM with multi-page navigation
      console.log(
        `⚠️ [Puppeteer Extractor] FB_PUBLIC_LOAD_DATA extraction yielded 0 questions, falling back to DOM extraction with page navigation...`
      );
      const domFormData = await this.extractFromDOMWithNavigation(page);

      console.log(
        `✅ [Puppeteer Extractor] DOM extraction completed with ${domFormData.questions.length} questions`
      );
      return domFormData;
    } catch (error) {
      console.error(`❌ [Puppeteer Extractor] Error: ${error.message}`);
      throw error;
    } finally {
      await browser.close();
    }
  }

  /**
   * Extract form data from FB_PUBLIC_LOAD_DATA script variable
   * This contains ALL questions from ALL pages in one data structure
   */
  async extractFromFBData(page) {
    return await page.evaluate(() => {
      const result = {
        title: "",
        description: "",
        questions: [],
        sections: [],
        debugInfo: {
          foundFBData: false,
          fbDataLength: 0,
          questionsDataLength: 0,
          extractionMethod: "FB_PUBLIC_LOAD_DATA",
          errors: [],
          logs: [],
        },
      };

      // Question type mapping
      const questionTypeMap = {
        0: "short_answer",
        1: "paragraph",
        2: "multiple_choice",
        3: "multiple_choice", // Checkboxes
        4: "multiple_choice", // Dropdown
        5: "scale",
        6: "multiple_choice", // Multiple choice grid
        7: "multiple_choice", // Checkbox grid
        8: "section_header", // Section/Page break
        9: "date",
        10: "time",
      };

      /**
       * Recursively search for question items in nested arrays
       * This handles multi-page forms where questions might be nested at various depths
       */
      function findQuestionsRecursively(data, depth = 0, maxDepth = 5) {
        const foundQuestions = [];

        if (depth > maxDepth || !data || !Array.isArray(data)) {
          return foundQuestions;
        }

        for (const item of data) {
          if (!Array.isArray(item)) continue;

          // Check if this item looks like a question (has the expected structure)
          // Question structure: [itemId, title, description, type, optionsData, ...]
          if (item.length >= 4) {
            const potentialId = item[0];
            const potentialTitle = item[1];
            const potentialType = item[3];

            // Validate this looks like a question
            if (
              potentialId !== null &&
              potentialId !== undefined &&
              typeof potentialTitle === "string" &&
              potentialTitle.trim().length > 0 &&
              typeof potentialType === "number" &&
              potentialType >= 0 &&
              potentialType <= 10
            ) {
              foundQuestions.push(item);
              continue; // Don't recurse into this item, we've already processed it
            }
          }

          // Recurse into nested arrays
          foundQuestions.push(
            ...findQuestionsRecursively(item, depth + 1, maxDepth)
          );
        }

        return foundQuestions;
      }

      /**
       * Parse a single question item into our format
       */
      function parseQuestionItem(q, currentSectionId) {
        const itemId = q[0];
        const title = q[1];
        const description = q[2] || "";
        const questionType = q[3] || 0;
        const optionsData = q[4];

        // Extract options
        let options = [];
        if (optionsData && Array.isArray(optionsData)) {
          optionsData.forEach((optArr) => {
            if (
              Array.isArray(optArr) &&
              optArr.length > 1 &&
              Array.isArray(optArr[1])
            ) {
              optArr[1].forEach((option) => {
                if (Array.isArray(option) && option[0] != null) {
                  const optionText = String(option[0]).trim();
                  if (optionText && !options.includes(optionText)) {
                    options.push(optionText);
                  }
                }
              });
            }
          });
        }

        // Handle scale questions
        let low = 1,
          high = 5,
          lowLabel = "Poor",
          highLabel = "Excellent";
        if (
          questionType === 5 &&
          optionsData &&
          Array.isArray(optionsData) &&
          optionsData.length >= 2
        ) {
          const scaleData = optionsData;
          if (
            scaleData[0] &&
            Array.isArray(scaleData[0]) &&
            scaleData[0].length >= 2
          ) {
            low = scaleData[0][0] || 1;
            high = scaleData[0][1] || 5;
          }
          if (
            scaleData[1] &&
            Array.isArray(scaleData[1]) &&
            scaleData[1].length >= 2
          ) {
            lowLabel = scaleData[1][0] || "Poor";
            highLabel = scaleData[1][1] || "Excellent";
          }
        }

        // Check if required
        let isRequired = false;
        if (optionsData && Array.isArray(optionsData)) {
          optionsData.forEach((optArr) => {
            if (Array.isArray(optArr) && optArr.length > 2 && optArr[2] === 1) {
              isRequired = true;
            }
          });
        }

        return {
          title: title.trim(),
          type: questionTypeMap[questionType] || "short_answer",
          required: isRequired,
          options: options,
          sectionId: String(currentSectionId),
          low: low,
          high: high,
          lowLabel: lowLabel,
          highLabel: highLabel,
          _originalType: questionType,
          _itemId: itemId,
        };
      }

      // Find and parse FB_PUBLIC_LOAD_DATA
      const scripts = document.querySelectorAll("script");

      for (const script of scripts) {
        const content = script.textContent;
        if (content && content.includes("FB_PUBLIC_LOAD_DATA_")) {
          try {
            // Try multiple regex patterns to extract the data
            const patterns = [
              /FB_PUBLIC_LOAD_DATA_[^=]*=\s*(\[[\s\S]*?\]);/,
              /var\s+FB_PUBLIC_LOAD_DATA_\w+\s*=\s*(\[[\s\S]*?\]);/,
              /FB_PUBLIC_LOAD_DATA_\w+\s*=\s*(\[[\s\S]*?\]);\s*(?:var|function|<)/,
            ];

            let dataMatch = null;
            for (const pattern of patterns) {
              dataMatch = content.match(pattern);
              if (dataMatch) break;
            }

            if (dataMatch && dataMatch[1]) {
              result.debugInfo.foundFBData = true;
              const parsedData = JSON.parse(dataMatch[1]);
              result.debugInfo.fbDataLength = Array.isArray(parsedData)
                ? parsedData.length
                : 0;

              // Extract title from parsedData[1][8] or similar locations
              if (Array.isArray(parsedData) && parsedData.length > 1) {
                const metaData = parsedData[1];
                if (Array.isArray(metaData) && metaData.length > 8) {
                  result.title = metaData[8] || "";
                  result.description = metaData[0] || "";
                }

                // Find questions using recursive search
                // Questions are typically in parsedData[1][1] but may be nested differently
                let allQuestionItems = [];

                // Try the standard location first: parsedData[1][1]
                if (
                  Array.isArray(metaData) &&
                  metaData.length > 1 &&
                  Array.isArray(metaData[1])
                ) {
                  const questionsArray = metaData[1];
                  result.debugInfo.questionsDataLength = questionsArray.length;
                  result.debugInfo.logs.push(
                    `Found ${questionsArray.length} items in parsedData[1][1]`
                  );

                  // Try direct extraction from this array
                  for (const q of questionsArray) {
                    if (Array.isArray(q) && q.length >= 4) {
                      const potentialType = q[3];
                      if (
                        typeof potentialType === "number" &&
                        potentialType >= 0 &&
                        potentialType <= 10
                      ) {
                        allQuestionItems.push(q);
                      }
                    }
                  }

                  // If direct extraction didn't find many questions, try recursive search
                  if (allQuestionItems.length < 2) {
                    result.debugInfo.logs.push(
                      `Direct extraction found ${allQuestionItems.length} items, trying recursive search...`
                    );
                    allQuestionItems = findQuestionsRecursively(
                      questionsArray,
                      0,
                      5
                    );
                    result.debugInfo.logs.push(
                      `Recursive search found ${allQuestionItems.length} items`
                    );
                  }
                }

                // If still no questions, search the entire parsedData structure
                if (allQuestionItems.length === 0) {
                  result.debugInfo.logs.push(
                    `No questions in standard location, searching entire data structure...`
                  );
                  allQuestionItems = findQuestionsRecursively(parsedData, 0, 6);
                  result.debugInfo.logs.push(
                    `Full recursive search found ${allQuestionItems.length} items`
                  );
                }

                // Process all found question items
                let currentSectionId = "main";
                let sectionCounter = 0;

                for (const q of allQuestionItems) {
                  const questionType = q[3] || 0;

                  // Handle Section Headers (Type 8)
                  if (questionType === 8) {
                    const sectionTitle =
                      q[1] || `Section ${sectionCounter + 1}`;
                    const sectionDesc = q[2] || "";
                    const sectionId = q[0]
                      ? String(q[0])
                      : `section_${sectionCounter}`;

                    result.sections.push({
                      id: sectionId,
                      title: sectionTitle,
                      description: sectionDesc,
                      sectionNumber: sectionCounter + 1,
                    });

                    currentSectionId = sectionId;
                    sectionCounter++;
                    continue;
                  }

                  // Skip items without valid titles
                  const title = q[1];
                  if (
                    !title ||
                    typeof title !== "string" ||
                    title.trim().length === 0
                  ) {
                    continue;
                  }

                  // Parse and add the question
                  const parsedQuestion = parseQuestionItem(q, currentSectionId);
                  result.questions.push(parsedQuestion);
                }

                result.debugInfo.logs.push(
                  `Final extraction: ${result.questions.length} questions, ${result.sections.length} sections`
                );

                if (result.questions.length > 0) {
                  break; // Found questions, stop processing scripts
                }
              }
            }
          } catch (parseError) {
            result.debugInfo.errors.push(`Parse error: ${parseError.message}`);
            continue;
          }
        }
      }

      // Extract title from DOM if not found
      if (!result.title) {
        const titleElement = document.querySelector("title");
        if (titleElement) {
          result.title = titleElement.textContent
            .replace(" - Google Forms", "")
            .trim();
        }
      }

      // Extract description from meta tag if not found
      if (!result.description) {
        const descElement = document.querySelector('meta[name="description"]');
        if (descElement) {
          result.description = descElement.getAttribute("content") || "";
        }
      }

      return result;
    });
  }

  /**
   * Extract form data from DOM with multi-page navigation
   * Used as fallback when FB_PUBLIC_LOAD_DATA extraction fails
   */
  async extractFromDOMWithNavigation(page) {
    const result = {
      title: "",
      description: "",
      questions: [],
      sections: [],
      debugInfo: {
        extractionMethod: "DOM_with_navigation",
        pagesNavigated: 0,
        errors: [],
        logs: [],
      },
    };

    let pageNumber = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      console.log(
        `📄 [Puppeteer Extractor] Extracting from page ${pageNumber}...`
      );
      result.debugInfo.pagesNavigated = pageNumber;

      // Extract questions from current page
      const pageData = await page.evaluate((currentPageNum) => {
        const pageQuestions = [];
        const pageTitle =
          document
            .querySelector("title")
            ?.textContent?.replace(" - Google Forms", "")
            .trim() || "";
        const pageDescription =
          document
            .querySelector('meta[name="description"]')
            ?.getAttribute("content") || "";

        // Try multiple selectors for question elements
        const selectors = [
          "[data-item-id]",
          '[role="listitem"]',
          ".freebirdFormviewerViewItemsItemItem",
          ".freebirdFormviewerComponentsQuestionBaseRoot",
        ];

        let questionElements = [];
        for (const selector of selectors) {
          questionElements = document.querySelectorAll(selector);
          if (questionElements.length > 0) break;
        }

        questionElements.forEach((element) => {
          // Extract question title
          const titleSelectors = [
            '[role="heading"]',
            ".freebirdFormviewerComponentsQuestionBaseTitle",
            '[jsname="V67aGc"]',
            ".M7eMe",
          ];

          let titleElement = null;
          for (const selector of titleSelectors) {
            titleElement = element.querySelector(selector);
            if (titleElement) break;
          }

          if (!titleElement) return;

          const questionTitle = titleElement.textContent.trim();
          if (!questionTitle || questionTitle.length < 2) return;

          // Determine question type and options
          let questionType = "short_answer";
          let options = [];

          if (element.querySelector("textarea")) {
            questionType = "paragraph";
          } else if (
            element.querySelector('input[type="radio"]') ||
            element.querySelector('[role="radio"]')
          ) {
            questionType = "multiple_choice";

            // Extract options
            const optionSelectors = [
              ".docssharedWizToggleLabeledLabelText",
              "label",
              ".ovnfwe",
              "[role='radio']",
              ".freebirdFormviewerComponentsQuestionRadioLabel",
            ];

            for (const selector of optionSelectors) {
              const foundElements = element.querySelectorAll(selector);
              if (foundElements.length > 0) {
                foundElements.forEach((el) => {
                  const text = el.textContent.trim();
                  if (
                    text &&
                    text !== questionTitle &&
                    !options.includes(text)
                  ) {
                    options.push(text);
                  }
                });
              }
              if (options.length > 0) break;
            }
          } else if (
            element.querySelector('input[type="checkbox"]') ||
            element.querySelector('[role="checkbox"]')
          ) {
            questionType = "multiple_choice";

            const optionSelectors = [
              ".docssharedWizToggleLabeledLabelText",
              "label",
              "[role='checkbox']",
              ".freebirdFormviewerComponentsQuestionCheckboxLabel",
            ];

            for (const selector of optionSelectors) {
              const foundElements = element.querySelectorAll(selector);
              if (foundElements.length > 0) {
                foundElements.forEach((el) => {
                  const text = el.textContent.trim();
                  if (
                    text &&
                    text !== questionTitle &&
                    !options.includes(text)
                  ) {
                    options.push(text);
                  }
                });
              }
              if (options.length > 0) break;
            }
          } else if (element.querySelector("select")) {
            questionType = "multiple_choice";
            const selectOptions = element.querySelectorAll("option");
            selectOptions.forEach((opt) => {
              const text = opt.textContent.trim();
              if (text && !text.includes("Choose")) {
                options.push(text);
              }
            });
          } else if (element.querySelector('input[type="date"]')) {
            questionType = "date";
          } else if (element.querySelector('input[type="time"]')) {
            questionType = "time";
          }

          // Check if required
          const isRequired =
            element.textContent.includes("*") ||
            element.querySelector('[aria-required="true"]') !== null;

          pageQuestions.push({
            title: questionTitle,
            type: questionType,
            required: isRequired,
            options: options,
            sectionId: `page_${currentPageNum}`,
            low: 1,
            high: 5,
            lowLabel: "Poor",
            highLabel: "Excellent",
          });
        });

        return {
          title: pageTitle,
          description: pageDescription,
          questions: pageQuestions,
        };
      }, pageNumber);

      // Add title and description from first page
      if (pageNumber === 1) {
        result.title = pageData.title;
        result.description = pageData.description;
      }

      // Add section for this page
      if (pageData.questions.length > 0) {
        result.sections.push({
          id: `page_${pageNumber}`,
          title: `Page ${pageNumber}`,
          description: "",
          sectionNumber: pageNumber,
        });
      }

      // Add questions from this page
      result.questions.push(...pageData.questions);
      result.debugInfo.logs.push(
        `Page ${pageNumber}: extracted ${pageData.questions.length} questions`
      );

      // Try to navigate to next page
      hasMorePages = await this.tryNavigateToNextPage(page);

      if (hasMorePages) {
        pageNumber++;
        // Wait for page transition
        await this.delay(1000);
      }

      // Safety limit: don't navigate more than 20 pages
      if (pageNumber > 20) {
        result.debugInfo.errors.push("Reached maximum page limit (20)");
        hasMorePages = false;
      }
    }

    result.debugInfo.logs.push(`Total pages navigated: ${pageNumber}`);
    result.debugInfo.logs.push(
      `Total questions extracted: ${result.questions.length}`
    );

    return result;
  }

  /**
   * Try to click the "Next" button to navigate to the next page
   * @returns {Promise<boolean>} True if successfully navigated to next page
   */
  async tryNavigateToNextPage(page) {
    try {
      // Common selectors for "Next" button in Google Forms
      const nextButtonSelectors = [
        'div[role="button"]:has-text("Next")',
        'span:has-text("Next")',
        '[jsname="OCpkoe"]', // Common jsname for next button
        '[aria-label="Next"]',
        'div[role="button"] span:contains("Next")',
      ];

      // Try to find and click the Next button
      const clicked = await page.evaluate(() => {
        // Look for buttons/elements that contain "Next" text
        const buttons = document.querySelectorAll(
          'div[role="button"], button, span'
        );

        for (const btn of buttons) {
          const text = btn.textContent.trim().toLowerCase();
          if (
            text === "next" ||
            text === "continue" ||
            text === "next section"
          ) {
            // Check if this button is visible
            const rect = btn.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              btn.click();
              return true;
            }
          }
        }

        // Also try looking for specific Google Forms navigation elements
        const navButtons = document.querySelectorAll(
          '[jsname="OCpkoe"], [data-item-id] div[role="button"]'
        );
        for (const btn of navButtons) {
          const text = btn.textContent.trim().toLowerCase();
          if (text.includes("next")) {
            btn.click();
            return true;
          }
        }

        return false;
      });

      return clicked;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new GoogleFormsExtractorPuppeteer();
