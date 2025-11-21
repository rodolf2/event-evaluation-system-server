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
    console.log(`🚀 [Puppeteer] Starting browser for form extraction...`);

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

      console.log(`🌐 [Puppeteer] Navigating to: ${url}`);

      // Navigate and wait for network idle (page fully loaded)
      await page.goto(url, {
        waitUntil: "networkidle0",
        timeout: 30000,
      });

      console.log(`✅ [Puppeteer] Page loaded successfully`);

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

      console.log(`📝 [Puppeteer] Script analysis:`);
      console.log(`   Total scripts: ${scriptInfo.totalScripts}`);
      console.log(
        `   Has FB_PUBLIC_LOAD_DATA: ${scriptInfo.hasFBPublicLoadData}`
      );

      // Extract form data from the page
      const formData = await page.evaluate(() => {
        const result = {
          title: "",
          description: "",
          questions: [],
          debugInfo: {
            foundFBData: false,
            fbDataLength: 0,
            questionsDataLength: 0,
            domElementsFound: 0,
            errors: [],
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

                if (Array.isArray(parsedData) && parsedData.length > 1) {
                  // Questions are typically in parsedData[1]
                  const questionsData = parsedData[1];
                  result.debugInfo.questionsDataLength = Array.isArray(
                    questionsData
                  )
                    ? questionsData.length
                    : 0;

                  if (Array.isArray(questionsData)) {
                    let currentSection = null;
                    let sectionCounter = 0;

                    for (let i = 0; i < questionsData.length; i++) {
                      const q = questionsData[i];

                      if (Array.isArray(q) && q.length >= 2) {
                        // Check if this is a section header
                        if (Array.isArray(q[1]) && q[1].length > 1) {
                          const qData = q[1];
                          const title = qData[1];
                          const questionType = qData[3] || 0;

                          if (questionType === 8) {
                            currentSection = title.trim();
                            sectionCounter++;
                            continue;
                          }

                          if (
                            title &&
                            typeof title === "string" &&
                            title.trim().length > 0 &&
                            questionType !== 8
                          ) {
                            const lowerTitle = title.toLowerCase().trim();

                            // Skip common name/email questions
                            const skipPatterns = [
                              /^name$/i,
                              /^full name$/i,
                              /^email$/i,
                              /^email address$/i,
                            ];

                            const shouldSkip = skipPatterns.some((pattern) =>
                              pattern.test(lowerTitle)
                            );

                            if (shouldSkip) continue;

                            // Extract options
                            let options = [];
                            if (qData[4] && Array.isArray(qData[4])) {
                              let rawOptions = qData[4];

                              // Handle nested options array
                              if (
                                rawOptions.length === 1 &&
                                Array.isArray(rawOptions[0]) &&
                                rawOptions[0].length > 0 &&
                                Array.isArray(rawOptions[0][0])
                              ) {
                                rawOptions = rawOptions[0];
                              }

                              options = rawOptions
                                .map((opt) => {
                                  if (Array.isArray(opt)) {
                                    // Safely convert to string before trim
                                    const value = opt[0];
                                    return value != null
                                      ? String(value).trim()
                                      : "";
                                  }
                                  return opt != null ? String(opt).trim() : "";
                                })
                                .filter((opt) => opt && opt.length > 0);
                            }

                            // Handle scale questions
                            let low = 1,
                              high = 5,
                              lowLabel = "Poor",
                              highLabel = "Excellent";
                            if (
                              questionType === 5 &&
                              qData[4] &&
                              Array.isArray(qData[4]) &&
                              qData[4].length >= 2
                            ) {
                              const scaleData = qData[4];
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

                            const isRequired = qData[2] === 1;

                            result.questions.push({
                              title: title.trim(),
                              type:
                                questionTypeMap[questionType] || "short_answer",
                              required: isRequired,
                              options: options,
                              section:
                                currentSection ||
                                `Section ${sectionCounter || 1}`,
                              low: low,
                              high: high,
                              lowLabel: lowLabel,
                              highLabel: highLabel,
                            });
                          }
                        }
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
              section: "Section 1",
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

      console.log(`📊 [Puppeteer] Extraction complete:`);
      console.log(`   Title: ${formData.title}`);
      console.log(`   Questions: ${formData.questions.length}`);
      console.log(`   Debug Info:`);
      console.log(
        `     - FB_PUBLIC_LOAD_DATA found: ${formData.debugInfo.foundFBData}`
      );
      console.log(`     - FB data length: ${formData.debugInfo.fbDataLength}`);
      console.log(
        `     - Questions data length: ${formData.debugInfo.questionsDataLength}`
      );
      console.log(
        `     - DOM elements found: ${formData.debugInfo.domElementsFound}`
      );
      if (formData.debugInfo.errors.length > 0) {
        console.log(`     - Errors: ${formData.debugInfo.errors.join(", ")}`);
      }

      return formData;
    } catch (error) {
      console.error(`❌ [Puppeteer] Error during extraction:`, error);
      throw error;
    } finally {
      await browser.close();
      console.log(`🔒 [Puppeteer] Browser closed`);
    }
  }
}

module.exports = new GoogleFormsExtractorPuppeteer();
