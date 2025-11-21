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
 */
class GoogleFormsExtractorPuppeteer {
  /**
   * Extract form data from a Google Forms URL
   * @param {string} url - The Google Forms URL
   * @returns {Promise<Object>} Extracted form data
   */
  async extractForm(url) {
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

      // Navigate and wait only for DOM content (much faster than networkidle0)
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      // First, let's check what scripts are available
      const scriptInfo = await page.evaluate(() => {
        const scripts = document.querySelectorAll("script");
        return {
          totalScripts: scripts.length,
          hasFBPublicLoadData: Array.from(scripts).some(
            (s) =>
              s.textContent && s.textContent.includes("FB_PUBLIC_LOAD_DATA_")
          ),
          scriptSample: Array.from(scripts)
            .filter(
              (s) =>
                s.textContent && s.textContent.includes("FB_PUBLIC_LOAD_DATA_")
            )
            .map((s) => s.textContent.substring(0, 200)),
        };
      });

      // Extract form data from the page
      const formData = await page.evaluate(() => {
        const result = {
          title: "",
          description: "",
          questions: [],
          sections: [],
          debugInfo: {
            foundFBData: false,
            fbDataLength: 0,
            questionsDataLength: 0,
            domElementsFound: 0,
            errors: [],
            logs: [],
          },
        };

        // Strategy 1: Try to get data from FB_PUBLIC_LOAD_DATA
        const scripts = document.querySelectorAll("script");

        for (const script of scripts) {
          const content = script.textContent;
          if (content && content.includes("FB_PUBLIC_LOAD_DATA_")) {
            try {
              // Try multiple regex patterns
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

                // Log top-level structure
                result.debugInfo.logs.push(`parsedData structure:`);
                if (Array.isArray(parsedData)) {
                  parsedData.forEach((item, idx) => {
                    result.debugInfo.logs.push(
                      `   parsedData[${idx}]: type=${typeof item}, isArray=${Array.isArray(
                        item
                      )}, length=${Array.isArray(item) ? item.length : "N/A"}`
                    );
                  });
                }

                if (Array.isArray(parsedData) && parsedData.length > 1) {
                  // Questions are typically in parsedData[1]
                  const questionsData = parsedData[1];
                  result.debugInfo.questionsDataLength = Array.isArray(
                    questionsData
                  )
                    ? questionsData.length
                    : 0;

                  if (
                    Array.isArray(questionsData) &&
                    questionsData.length > 1
                  ) {
                    // The actual questions array is at index 1 of questionsData
                    const actualQuestionsArray = questionsData[1];
                    if (!Array.isArray(actualQuestionsArray)) {
                      result.debugInfo.errors.push(
                        "Questions array not found in expected location"
                      );
                      continue;
                    }

                    let currentSectionId = "main";
                    let sectionCounter = 0;

                    // Log first few items fully to understand structure
                    result.debugInfo.logs.push(
                      `First 10 items in actualQuestionsArray:`
                    );
                    actualQuestionsArray.slice(0, 10).forEach((q, idx) => {
                      try {
                        result.debugInfo.logs.push(
                          `   Item ${idx}: ${JSON.stringify(q).substring(
                            0,
                            500
                          )}`
                        );
                      } catch (e) {
                        result.debugInfo.logs.push(
                          `   Item ${idx}: [Error stringifying]`
                        );
                      }
                    });

                    for (let i = 0; i < actualQuestionsArray.length; i++) {
                      const q = actualQuestionsArray[i];

                      try {
                        if (Array.isArray(q) && q.length >= 5) {
                          const itemId = q[0];
                          const title = q[1];
                          const description = q[2];
                          const questionType = q[3] || 0;
                          const optionsData = q[4];

                          // Handle Section Headers (Type 8)
                          if (questionType === 8) {
                            const sectionTitle =
                              title || `Section ${sectionCounter + 1}`;
                            const sectionDesc = description || "";
                            // Ensure ID is a string to avoid type mismatches (number vs string) in frontend
                            const sectionId = itemId
                              ? String(itemId)
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

                          // Process all questions, even those with empty titles (they might have titles in other positions)
                          let processedTitle = title;
                          if (
                            !processedTitle ||
                            typeof processedTitle !== "string" ||
                            processedTitle.trim().length === 0
                          ) {
                            // Try to get title from the last element if it's an array with title
                            // BUT only if this doesn't look like it came from a section
                            if (
                              Array.isArray(q[q.length - 1]) &&
                              q[q.length - 1][1] &&
                              typeof q[q.length - 1][1] === "string"
                            ) {
                              const potentialTitle = q[q.length - 1][1];
                              // Strip HTML tags and check if it looks valid
                              const cleanTitle = potentialTitle
                                .replace(/<[^>]*>/g, "")
                                .trim();
                              // Only use it if it's not empty and doesn't match recent section titles
                              const isRecentSectionTitle = result.sections.some(
                                (s) => s.title === cleanTitle
                              );
                              if (cleanTitle && !isRecentSectionTitle) {
                                processedTitle = cleanTitle;
                              }
                            }

                            // If still no valid title, skip this item entirely (it's likely malformed)
                            if (
                              !processedTitle ||
                              typeof processedTitle !== "string" ||
                              processedTitle.trim().length === 0
                            ) {
                              continue; // Skip this question entirely
                            }
                          }

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
                                  if (
                                    Array.isArray(option) &&
                                    option[0] != null
                                  ) {
                                    const optionText = String(option[0]).trim();
                                    if (
                                      optionText &&
                                      !options.includes(optionText)
                                    ) {
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

                          const questionTypeMap = {
                            0: "short_answer",
                            1: "paragraph",
                            2: "multiple_choice",
                            3: "multiple_choice",
                            4: "multiple_choice",
                            5: "scale",
                            6: "multiple_choice",
                            7: "multiple_choice",
                            9: "date",
                            10: "time",
                          };

                          // Check if required - look for the nested array that contains the required flag
                          let isRequired = false;
                          if (optionsData && Array.isArray(optionsData)) {
                            optionsData.forEach((optArr) => {
                              if (Array.isArray(optArr) && optArr.length > 2) {
                                if (optArr[2] === 1) {
                                  isRequired = true;
                                }
                              }
                            });
                          }

                          result.questions.push({
                            title: processedTitle.trim(),
                            type:
                              questionTypeMap[questionType] || "short_answer",
                            required: isRequired,
                            options: options,
                            sectionId: String(currentSectionId), // Ensure string
                            low: low,
                            high: high,
                            lowLabel: lowLabel,
                            highLabel: highLabel,
                          });
                        }
                      } catch (itemError) {
                        result.debugInfo.errors.push(
                          `Error processing item ${i}: ${itemError.message}`
                        );
                      }
                    }

                    if (result.questions.length > 0) {
                      break; // Found questions, stop processing scripts
                    }
                  }
                }
              }
            } catch (parseError) {
              result.debugInfo.errors.push(
                `Parse error: ${parseError.message}`
              );
              continue;
            }
          }
        }

        // Strategy 2: Fallback to DOM extraction if FB_PUBLIC_LOAD_DATA didn't work OR produced poor results
        const hasPoorQualityQuestions = result.questions.some(
          (q) =>
            (q.type === "multiple_choice" || q.type === "checkbox") &&
            (!q.options || q.options.length === 0)
        );

        if (result.questions.length === 0 || hasPoorQualityQuestions) {
          if (hasPoorQualityQuestions) {
            // Clear poor quality questions to allow DOM extraction to take over
            result.questions = [];
            result.debugInfo.errors.push(
              "Script extraction produced questions with missing options. Falling back to DOM extraction."
            );
          }
          // Extract title
          const titleElement = document.querySelector("title");
          if (titleElement) {
            result.title = titleElement.textContent
              .replace(" - Google Forms", "")
              .trim();
          }

          // Extract description
          const descElement = document.querySelector(
            'meta[name="description"]'
          );
          if (descElement) {
            result.description = descElement.getAttribute("content") || "";
          }

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
            if (questionElements.length > 0) {
              result.debugInfo.domElementsFound = questionElements.length;
              break;
            }
          }

          questionElements.forEach((element) => {
            // Try multiple selectors for question title
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

            // Determine question type based on input elements
            let questionType = "short_answer";
            let options = [];

            if (element.querySelector("textarea")) {
              questionType = "paragraph";
            } else if (
              element.querySelector('input[type="radio"]') ||
              element.querySelector('input[type="checkbox"]') ||
              element.querySelector('[role="radio"]') ||
              element.querySelector('[role="checkbox"]')
            ) {
              questionType = "multiple_choice";

              // Robust option extraction using multiple potential selectors
              const optionSelectors = [
                ".docssharedWizToggleLabeledLabelText", // Modern Google Forms
                "label", // Classic
                ".ovnfwe", // Another common class
                "[role='radio']",
                "[role='checkbox']",
                ".freebirdFormviewerComponentsQuestionRadioLabel",
                ".freebirdFormviewerComponentsQuestionCheckboxLabel",
              ];

              for (const selector of optionSelectors) {
                const foundElements = element.querySelectorAll(selector);
                if (foundElements.length > 0) {
                  foundElements.forEach((el) => {
                    const text = el.textContent.trim();
                    // Avoid capturing the question title itself or empty strings
                    if (
                      text &&
                      text !== questionTitle &&
                      !options.includes(text)
                    ) {
                      options.push(text);
                    }
                  });
                }
                // If we found options, stop trying other selectors to avoid duplicates/noise
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

            // Check if required (usually has an asterisk)
            const isRequired =
              element.textContent.includes("*") ||
              element.querySelector('[aria-required="true"]') !== null;

            result.questions.push({
              title: questionTitle,
              type: questionType,
              required: isRequired,
              options: options,
              sectionId: "main", // Default section for DOM extraction
              low: 1,
              high: 5,
              lowLabel: "Poor",
              highLabel: "Excellent",
            });
          });
        }

        // Extract title if not already set
        if (!result.title) {
          const titleElement = document.querySelector("title");
          if (titleElement) {
            result.title = titleElement.textContent
              .replace(" - Google Forms", "")
              .trim();
          }
        }

        // Extract description if not already set
        if (!result.description) {
          const descElement = document.querySelector(
            'meta[name="description"]'
          );
          if (descElement) {
            result.description = descElement.getAttribute("content") || "";
          }
        }

        return result;
      });

      return formData;
    } catch (error) {
      throw error;
    } finally {
      await browser.close();
    }
  }
}

module.exports = new GoogleFormsExtractorPuppeteer();
