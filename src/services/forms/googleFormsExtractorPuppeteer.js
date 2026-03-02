const puppeteer = require("puppeteer");

// Try to load @sparticuz/chromium for serverless environments (Render, AWS Lambda, etc.)
let chromium;
try {
  chromium = require("@sparticuz/chromium");
} catch (e) {
  chromium = null;
}

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
    console.log(`   PUPPETEER_CACHE_DIR: ${process.env.PUPPETEER_CACHE_DIR || "Not set"}`);
    console.log(`   RENDER environment: ${process.env.RENDER || "Not set"}`);
    console.log(`   Current working directory: ${process.cwd()}`);
    console.log(`   __dirname: ${__dirname}`);
    console.log(`   @sparticuz/chromium available: ${chromium ? "Yes" : "No"}`);

    let browser;
    
    // Use @sparticuz/chromium on Render (serverless), regular puppeteer locally
    if (process.env.RENDER === 'true' && chromium) {
      console.log(`   Using @sparticuz/chromium for Render deployment...`);
      const puppeteerCore = require("puppeteer-core");
      
      browser = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else {
      console.log(`   Using regular Puppeteer...`);
      
      // Check if .puppeteerrc.cjs exists and what it resolves to
      const path = require('path');
      const fs = require('fs');
      const puppeteerConfigPath = path.join(__dirname, '..', '..', '..', '.puppeteerrc.cjs');
      console.log(`   Looking for .puppeteerrc.cjs at: ${puppeteerConfigPath}`);
      console.log(`   .puppeteerrc.cjs exists: ${fs.existsSync(puppeteerConfigPath)}`);

      if (fs.existsSync(puppeteerConfigPath)) {
        const config = require(puppeteerConfigPath);
        console.log(`   .puppeteerrc.cjs cacheDirectory: ${config.cacheDirectory}`);
        console.log(`   Resolved cacheDirectory: ${path.resolve(config.cacheDirectory)}`);
      }

      browser = await puppeteer.launch({
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
    }

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
   * Static extraction fallback using axios and regex
   * Bypasses Puppeteer for better reliability in resource-constrained environments
   * @param {string} url - The Google Forms URL
   * @returns {Promise<Object>} Extracted form data
   */
  async extractFormStatic(url) {
    const axios = require("axios");
    console.log(`\n🔍 [Static Extractor] Starting extraction for: ${url}`);
    
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        timeout: 15000
      });

      const html = response.data;
      console.log(`✅ [Static Extractor] Fetched HTML (${html.length} bytes)`);

      // Mock a 'page' like object with an evaluate function that we can run locally
      const result = this.parseFBDataFromHTML(html);

      if (result && result.questions && result.questions.length > 0) {
        console.log(`✅ [Static Extractor] Successfully extracted ${result.questions.length} questions`);
        return result;
      }

      throw new Error("Static extraction yielded 0 questions");
    } catch (error) {
      console.error(`❌ [Static Extractor] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper to parse FB_PUBLIC_LOAD_DATA from raw HTML string
   * This is a Node.js implementation of the logic in extractFromFBData
   */
  parseFBDataFromHTML(html) {
    const result = {
      title: "",
      description: "",
      questions: [],
      sections: [],
      debugInfo: {
        foundFBData: false,
        extractionMethod: "Static_HTML_Regex",
        errors: [],
        logs: []
      }
    };

    // 1. Extract Title and Description from Meta/Title tags as fallback
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    if (titleMatch) result.title = titleMatch[1].replace(" - Google Forms", "").trim();
    
    const descMatch = html.match(/<meta\s+name="description"\s+content="(.*?)"/i);
    if (descMatch) result.description = descMatch[1];

    // 2. Find FB_PUBLIC_LOAD_DATA via Regex
    const patterns = [
      /FB_PUBLIC_LOAD_DATA_[^=]*=\s*(\[[\s\S]*?\]);/,
      /var\s+FB_PUBLIC_LOAD_DATA_\w+\s*=\s*(\[[\s\S]*?\]);/,
      /FB_PUBLIC_LOAD_DATA_.*?=\s*(\[[\s\S]*?\]);/
    ];

    let jsonStr = null;
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        jsonStr = match[1];
        break;
      }
    }

    if (!jsonStr) {
      result.debugInfo.errors.push("Could not find FB_PUBLIC_LOAD_DATA in HTML");
      return result;
    }

    try {
      const parsedData = JSON.parse(jsonStr);
      result.debugInfo.foundFBData = true;

      if (!Array.isArray(parsedData) || parsedData.length <= 1) return result;

      const metaData = parsedData[1];
      if (Array.isArray(metaData)) {
        // Find title/desc in metaData if not already found
        if (metaData.length > 8 && !result.title) result.title = metaData[8] || "";
        if (metaData.length > 0 && !result.description) result.description = metaData[0] || "";
      }

      const questionTypeMap = {
        0: "short_answer", 1: "paragraph", 2: "multiple_choice", 3: "multiple_choice", 
        4: "multiple_choice", 5: "scale", 6: "multiple_choice", 7: "multiple_choice", 
        8: "section_header", 9: "date", 10: "time", 18: "scale"
      };

      /**
       * Robust recursive search mirroring extractFromFBData
       */
      function findQuestionsRecursively(data, depth = 0, maxDepth = 10) {
        let found = [];
        if (depth > maxDepth || !data || !Array.isArray(data)) return found;

        for (const item of data) {
          if (!Array.isArray(item)) continue;

          // Structure check: [id, title, desc, type, ...]
          if (item.length >= 4 && 
              typeof item[1] === 'string' && item[1].trim() !== "" &&
              typeof item[3] === 'number') {
            found.push(item);
            // Don't recurse into found question to avoid double-counting if they nest strange things
            continue;
          }

          found.push(...findQuestionsRecursively(item, depth + 1, maxDepth));
        }
        return found;
      }

      const allItems = findQuestionsRecursively(parsedData);

      let currentSectionId = "main";
      let sectionCounter = 0;

      for (const q of allItems) {
        const type = q[3];
        const id = q[0];
        const title = (q[1] || "").trim();
        const desc = q[2] || "";

        if (type === 8) {
          currentSectionId = String(id || `sec_${sectionCounter++}`);
          result.sections.push({ id: currentSectionId, title: title || `Section ${sectionCounter}`, description: desc });
          continue;
        }

        let options = [];
        let low = 1, high = 5, lowLabel = "Poor", highLabel = "Excellent";

        if (q[4] && Array.isArray(q[4])) {
          const optData = q[4];
          if (type === 5) {
            if (Array.isArray(optData[0])) {
              low = parseInt(optData[0][0]) || 1;
              high = parseInt(optData[0][1]) || 5;
            }
            for (let i = 1; i < optData.length; i++) {
              if (Array.isArray(optData[i]) && optData[i].length >= 2 && typeof optData[i][0] === 'string') {
                lowLabel = optData[i][0];
                highLabel = optData[i][optData[i].length - 1];
                break;
              }
            }
          } else if (type === 18) {
             if (optData[0] && Array.isArray(optData[0][1])) {
               const opts = optData[0][1].map(o => Array.isArray(o) ? o[0] : o).filter(v => v !== null && v !== undefined);
               if (opts.length > 0) {
                 const nums = opts.map(Number).filter(n => !isNaN(n)).sort((a,b)=>a-b);
                 if (nums.length > 0) {
                   low = nums[0]; high = nums[nums.length-1];
                 }
                 lowLabel = ""; highLabel = "";
               }
             }
          } else {
            optData.forEach(optGroup => {
              if (Array.isArray(optGroup) && Array.isArray(optGroup[1])) {
                optGroup[1].forEach(opt => {
                  if (Array.isArray(opt) && opt[0] !== null) options.push(String(opt[0]).trim());
                });
              }
            });
          }
        }

        result.questions.push({
          id, title, type: questionTypeMap[type] || "short_answer",
          required: q[4] && q[4][0] && q[4][0][2] === 1,
          options, sectionId: currentSectionId,
          low, high, lowLabel, highLabel
        });
      }

      return result;
    } catch (err) {
      result.debugInfo.errors.push(`JSON Parse Error: ${err.message}`);
      return result;
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
          rawDump: null // Placeholder for raw data export
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
        18: "scale",
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
              potentialType <= 100 // Expanded to allow newer types like 18
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
        let questionType = q[3] || 0;
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

        // Handle scale questions (Type 5)
        let low = 1,
          high = 5,
          lowLabel = "Poor",
          highLabel = "Excellent";

        if (questionType === 5) {
          // Attempt to extract scale labels and range from optionsData
          // Even if structure doesn't match perfectly, we identify it as a scale
          if (optionsData && Array.isArray(optionsData) && optionsData.length >= 1) {
            const scaleData = optionsData;
            // Try to find range: often in index 0 e.g. ["1", "5"]
            if (scaleData[0] && Array.isArray(scaleData[0]) && scaleData[0].length >= 2) {
              // Sometimes it's strings "1", sometimes numbers
              low = parseInt(scaleData[0][0]) || 1;
              high = parseInt(scaleData[0][1]) || 5;
            }

            // Try to find labels: often in index 1 e.g. ["Low", "High"]
            // OR sometimes in index 3 for newer forms
            if (scaleData.length > 1) {
              // Look for array of strings which indicates labels
              for (let i = 1; i < scaleData.length; i++) {
                if (Array.isArray(scaleData[i]) && scaleData[i].length >= 2 && typeof scaleData[i][0] === 'string') {
                  lowLabel = scaleData[i][0] || "Poor";
                  highLabel = scaleData[i][scaleData[i].length - 1] || "Excellent";
                  break;
                }
              }
            }
          }
        }

        // Handle Type 18 (Likely another form of Scale/Rating)
        // Structure: q[4][0][1] contains options like [["1"], ["2"], ["3"], ["4"], ["5"]]
        if (questionType === 18) {
          questionType = 5; // Treat as scale

          if (optionsData && Array.isArray(optionsData) && optionsData.length > 0) {
            const innerData = optionsData[0]; // q[4][0]
            if (innerData && Array.isArray(innerData) && innerData.length > 1) {
              const rawOptions = innerData[1]; // q[4][0][1]
              if (Array.isArray(rawOptions)) {
                // Extract values
                const extractedOptions = rawOptions.map(o => Array.isArray(o) ? o[0] : o).filter(Boolean);

                // Check if they are numeric
                const nums = extractedOptions.map(Number).filter(n => !isNaN(n));

                if (nums.length > 0) {
                  nums.sort((a, b) => a - b);
                  low = nums[0];
                  high = nums[nums.length - 1];

                  // CRITICAL: Type 18 (Rating) should map to "Numeric Ratings" in frontend
                  // "Numeric Ratings" is chosen if labels are missing.
                  // So we must clear the default "Poor"/"Excellent" labels.
                  lowLabel = "";
                  highLabel = "";
                }

                // Populating options just in case
                options = extractedOptions;
              }
            }
          }
        }

        // Check if required - It's often in q[4][0][2]
        let isRequired = false;
        if (optionsData && Array.isArray(optionsData) && optionsData.length > 0) {
          const firstOptionGroup = optionsData[0];
          if (Array.isArray(firstOptionGroup) && firstOptionGroup.length > 2) {
            // 1 usually means required in Google's internal format
            isRequired = firstOptionGroup[2] === 1;
          }
        }

        // Check required in the main question array q[2]
        // q structure: [id, title, description, type, options, ??, ??, ??, ??, ??, required?]

        // --- INFERENCE LOGIC: Detect Scale disguised as Multiple Choice ---
        // Some "Stars" or "Rating" questions come as Type 2 (Multiple Choice) or Type 4 (Dropdown) 
        // with pure numeric options like ["1", "2", "3", "4", "5"]
        if (
          (questionType === 2 || questionType === 4 || questionType === 0) && // Multiple Match, Dropdown, or even Short Answer acting weird
          options &&
          options.length >= 3 && // Must have at least 3 options to be a meaningful scale
          options.length <= 11 // Rarely scales go beyond 10 or 11
        ) {
          const isNumeric = options.every(opt => !isNaN(parseInt(opt)) && isFinite(opt));
          // Also check if they are sequential integers?
          // For now, simpler check: if all numeric, assume scale.
          if (isNumeric) {
            // infer correct low/high
            const nums = options.map(Number).sort((a, b) => a - b);
            const min = nums[0];
            const max = nums[nums.length - 1];

            // Check if sequential interval is roughly 1
            const isSequential = nums.every((val, i, arr) => i === 0 || (val - arr[i - 1]) === 1);

            if (isSequential) {
              questionType = 5; // Override to scale
              low = min;
              high = max;
              // Default labels if not explicitly found
              lowLabel = lowLabel || "Low";
              highLabel = highLabel || "High";
            }
          }
        }

        // Let's defer to the standard patterns found in findQuestionsRecursively or just default false

        // Double check options extraction for non-scale
        if (questionType !== 5 && (!options || options.length === 0)) {
          // Try enabling options extraction for other types if we missed them
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
              /FB_PUBLIC_LOAD_DATA_.*?=\s*(\[[\s\S]*?\]);/,
            ];

            let dataMatch = null;
            for (const pattern of patterns) {
              dataMatch = content.match(pattern);
              if (dataMatch) break;
            }

            if (dataMatch && dataMatch[1]) {
              result.debugInfo.foundFBData = true;
              const parsedData = JSON.parse(dataMatch[1]);

              // Assign raw data to result for saving in Node context
              result.debugInfo.rawDump = parsedData;

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

                  // Always use recursive search to find all questions regardless of nesting
                  allQuestionItems = findQuestionsRecursively(questionsArray, 0, 10);

                  result.debugInfo.logs.push(
                    `Found ${allQuestionItems.length} questions using deep recursive search`
                  );
                }

                // If still no questions, search the entire parsedData structure
                if (allQuestionItems.length === 0) {
                  result.debugInfo.logs.push(
                    `No questions in standard location, searching entire data structure...`
                  );
                  allQuestionItems = findQuestionsRecursively(parsedData, 0, 10);
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
          } else if (
            element.querySelector('[role="radiogroup"]') ||
            element.querySelector('.freebirdFormviewerComponentsQuestionScaleRoot') ||
            element.getAttribute('role') === 'radiogroup'
          ) {
            // Explicitly handle Linear Scale / Radiogroup
            questionType = "scale";
            // Try to extract min/max labels if possible
            // Usually first and last labels in the group
            const labels = Array.from(element.querySelectorAll('label, .freebirdFormviewerComponentsQuestionScaleLabel'));
            if (labels.length >= 2) {
              // First label is usually low label, last is high
            }
          } else if (element.querySelector("select")) {
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

          const question = {
            title: questionTitle,
            type: questionType,
            required: isRequired,
            options: options,
            sectionId: `page_${currentPageNum}`,
            low: 1,
            high: 5,
            lowLabel: "Poor",
            highLabel: "Excellent",
          };

          // Use inferred type logic
          if (question.type === "multiple_choice" && question.options.length >= 2) {
            // Check if options look like a scale (numeric sequence)
            const isNumericScale = question.options.every(opt => !isNaN(parseInt(opt)));
            if (isNumericScale) {
              const values = question.options.map(opt => parseInt(opt)).sort((a, b) => a - b);
              // Check if sequential
              let isSequential = true;
              for (let i = 0; i < values.length - 1; i++) {
                if (values[i + 1] !== values[i] + 1) isSequential = false;
              }

              if (isSequential) {
                question.type = "scale";
                question.low = values[0];
                question.high = values[values.length - 1];
                // Try to find labels like "Poor", "Excellent"
                // These are often in separate elements near the ends of the radio group
                // But simplified default is fine for now
              }
            }
          }

          // Force check for specific scale structure if not yet identified
          if (element.querySelector('[aria-label*="Linear scale"]')) {
            question.type = "scale";
          }

          pageQuestions.push(question);
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

    result.debugInfo.logs.push(`Total pages navigated: ${pageNumber} `);
    result.debugInfo.logs.push(
      `Total questions extracted: ${result.questions.length} `
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

  /**
   * Extract responses from form analytics page
   * @param {string} url - The Google Forms URL
   * @returns {Promise<Object>} Extracted response data
   */
  async extractResponses(url) {
    console.log(`\n🔍 [Puppeteer Extractor] Starting response extraction for: ${url}`);

    // Convert viewform URL to viewanalytics
    // e.g. https://docs.google.com/forms/d/e/.../viewform -> .../viewanalytics
    let analyticsUrl = url;
    if (url.includes("/viewform")) {
      analyticsUrl = url.replace("/viewform", "/viewanalytics");
    } else if (!url.includes("/viewanalytics")) {
      // Try appending if it doesn't have either
      if (url.endsWith("/")) {
        analyticsUrl = url + "viewanalytics";
      } else {
        analyticsUrl = url + "/viewanalytics";
      }
    }

    console.log(`🔗 [Puppeteer Extractor] Analytics URL: ${analyticsUrl}`);

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
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );

      // Navigate to analytics page
      // We don't block resources here as we might need charts to load (though we scrape text mostly)
      await page.goto(analyticsUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Wait a bit for any dynamic content to load
      await this.delay(2000);

      // Take a screenshot for debugging (save to file system)
      try {
        const fs = require('fs');
        const path = require('path');
        const screenshotDir = path.join(__dirname, '..', '..', '..', 'debug_screenshots');
        if (!fs.existsSync(screenshotDir)) {
          fs.mkdirSync(screenshotDir, { recursive: true });
        }
        const screenshotPath = path.join(screenshotDir, `analytics-${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`📸 [Puppeteer Extractor] Saved screenshot to: ${screenshotPath}`);
        
        // Also save the HTML content for debugging
        const htmlContent = await page.content();
        const htmlPath = path.join(screenshotDir, `analytics-${Date.now()}.html`);
        fs.writeFileSync(htmlPath, htmlContent);
        console.log(`📄 [Puppeteer Extractor] Saved HTML to: ${htmlPath}`);
      } catch (screenshotError) {
        console.warn(`⚠️ [Puppeteer Extractor] Could not save screenshot: ${screenshotError.message}`);
      }

      // Check if we were redirected to a login page or permission denied
      const currentUrl = page.url();
      if (currentUrl.includes("accounts.google.com") || currentUrl.includes("ServiceLogin")) {
        console.warn("⚠️ [Puppeteer Extractor] Redirected to login. Analytics are likely private.");
        return {
          responseCount: 0,
          analytics: {},
          isPrivate: true
        };
      }

      // Check for specific "You need permission" content
      const content = await page.content();
      if (content.includes("You need permission") || content.includes("You need access")) {
        console.warn("⚠️ [Puppeteer Extractor] Access denied. Analytics are private.");
        return {
          responseCount: 0,
          analytics: {},
          isPrivate: true
        };
      }

      // Extract response count
      const responseCount = await page.evaluate(() => {
        // Log the page content for debugging
        console.log('Page URL:', window.location.href);
        console.log('Page title:', document.title);
        
        // Look for the big number at the top
        // The structure varies, but often it's in a specific class or near "responses" text
        const countElements = Array.from(document.querySelectorAll('div'));
        const responseLabel = countElements.find(el => el.textContent.trim().toLowerCase() === 'responses');

        if (responseLabel) {
          // Usually the number is in a sibling or parent/child relationship
          // This is a naive heuristic
          const parent = responseLabel.parentElement;
          if (parent) {
            const number = parent.querySelector('.freebirdFormviewerViewAnalyticsAnalyticsPageSummaryCount');
            if (number) {
              console.log('Found response count via responseLabel parent:', number.textContent);
              return parseInt(number.textContent.replace(/,/g, '')) || 0;
            }
          }
        }

        // Try specific class for count
        const countEl = document.querySelector('.freebirdFormviewerViewAnalyticsAnalyticsPageSummaryCount');
        if (countEl) {
          console.log('Found response count via class selector:', countEl.textContent);
          return parseInt(countEl.textContent.trim().replace(/,/g, '')) || 0;
        }

        // Try looking for "X responses" text
        const bodyText = document.body.innerText;
        const match = bodyText.match(/(\d+)\s+responses?/i);
        if (match) {
          console.log('Found response count via text match:', match[1]);
          return parseInt(match[1]) || 0;
        }

        // Try looking for numbers in common analytics containers
        const analyticsContainers = document.querySelectorAll('[class*="analytics"], [class*="summary"], [class*="response"]');
        for (const container of analyticsContainers) {
          const text = container.textContent || '';
          const numMatch = text.match(/(\d+)/);
          if (numMatch && parseInt(numMatch[1]) > 0) {
            // Check if this looks like a response count (usually a larger number at the top)
            const num = parseInt(numMatch[1]);
            if (num > 0) {
              console.log('Found potential response count in container:', num);
              return num;
            }
          }
        }

        // Check for any large numbers that might be response counts
        const allNumbers = bodyText.match(/\b(\d{1,5})\b/g);
        if (allNumbers && allNumbers.length > 0) {
          // Take the first reasonably sized number as a fallback
          for (const numStr of allNumbers) {
            const num = parseInt(numStr);
            if (num > 0 && num < 100000) {
              console.log('Using fallback number as response count:', num);
              return num;
            }
          }
        }

        console.log('Could not find response count on page');
        return 0;
      });

      console.log(`📊 [Puppeteer Extractor] Found ${responseCount} responses`);

      // Extract basic analytics if available
      // This is complex as Google Charts are canvas/svg often
      // We'll try to get text summaries for each question
      const analyticsData = await page.evaluate(() => {
        const summaries = {};

        // Find question blocks
        // This selector is a guess based on common class names, might need adjustment
        const questionBlocks = document.querySelectorAll('.freebirdFormviewerViewAnalyticsQuestionBaseRoot');

        questionBlocks.forEach(block => {
          const titleEl = block.querySelector('.freebirdFormviewerViewAnalyticsQuestionBaseTitle');
          if (!titleEl) return;

          const title = titleEl.textContent.trim();
          const summaryData = {};

          // Try to find bar chart labels and counts
          const chartRows = block.querySelectorAll('.freebirdFormviewerViewAnalyticsChartBarRow');
          if (chartRows.length > 0) {
            const distribution = [];
            chartRows.forEach(row => {
              const label = row.querySelector('.freebirdFormviewerViewAnalyticsChartBarLabel')?.textContent?.trim();
              const count = row.querySelector('.freebirdFormviewerViewAnalyticsChartBarCount')?.textContent?.trim();
              if (label) {
                distribution.push({ label, count: parseInt(count) || 0 });
              }
            });
            summaryData.type = 'chart';
            summaryData.distribution = distribution;
          }

          // Try to find text responses (if listed)
          const text_responses = block.querySelectorAll('.freebirdFormviewerViewAnalyticsTextResponse');
          if (text_responses.length > 0) {
            const texts = [];
            text_responses.forEach(tr => texts.push(tr.textContent.trim()));
            summaryData.type = 'text';
            summaryData.sampleResponses = texts.slice(0, 5); // Limit to 5
          }

          summaries[title] = summaryData;
        });

        return summaries;
      });

      return {
        responseCount,
        analytics: analyticsData,
        isPrivate: false
      };

    } catch (error) {
      console.error(`❌ [Puppeteer Extractor] Response extraction error: ${error.message}`);
      // Don't fail the whole process just because analytics failed
      return {
        responseCount: 0,
        analytics: {},
        error: error.message
      };
    } finally {
      await browser.close();
    }
  }
}

module.exports = new GoogleFormsExtractorPuppeteer();
