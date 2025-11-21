const { GoogleGenerativeAI } = require("@google/generative-ai");
const Form = require("../../models/Form");
const mongoose = require("mongoose");
const axios = require("axios");
const cheerio = require("cheerio");
const fileParser = require("../../utils/fileParser");
const csv = require("csv-parser");
const xlsx = require("xlsx");
const fs = require("fs");

class FormsService {
  // Extract data from uploaded file without creating form
  async extractDataFromFile({ filePath, fileName }) {
    try {
      // Try to extract questions from the uploaded file
      let extractedData;
      let questions = [];

      try {
        extractedData = await fileParser.extractQuestionsFromFile(filePath);
        questions = extractedData.questions || [];
      } catch (parseError) {
        // If parsing completely fails, we'll use fallback questions below
      }

      // If no questions were extracted from the file, use dynamic fallback based on file type
      if (!questions || questions.length === 0) {
        const fileExt = fileName.split(".").pop()?.toLowerCase();
        questions = this.generateFallbackQuestions(fileName, fileExt);
      }

      const finalData = {
        title: extractedData?.title || this.generateTitleFromFilename(fileName),
        description:
          extractedData?.description ||
          `Form created from uploaded ${fileName
            .split(".")
            .pop()
            ?.toUpperCase()} file`,
        questions: questions,
        uploadedFiles: [
          {
            filename: fileName,
            originalName: fileName,
            path: filePath,
            size: 0, // Would need to get actual file size
            uploadedAt: new Date(),
          },
        ],
      };
      return finalData;
    } catch (error) {
      console.error("Error extracting data from file:", error);
      throw error;
    }
  }

  // Generate appropriate fallback questions based on file type
  generateFallbackQuestions(fileName, fileExt) {
    const baseQuestions = [];

    switch (fileExt) {
      case "pdf":
        baseQuestions.push(
          {
            title: "Please provide feedback on the document content",
            type: "paragraph",
            required: false,
            options: [],
          },
          {
            title: "How useful did you find this document?",
            type: "scale",
            required: false,
            options: [],
            low: 1,
            high: 5,
            lowLabel: "Not useful",
            highLabel: "Very useful",
          }
        );
        break;

      case "docx":
      case "doc":
        baseQuestions.push(
          {
            title: "Please provide feedback on the document",
            type: "paragraph",
            required: false,
            options: [],
          },
          {
            title: "Does this document meet your needs?",
            type: "multiple_choice",
            required: false,
            options: ["Yes, completely", "Mostly", "Somewhat", "Not at all"],
          }
        );
        break;

      case "csv":
      case "xlsx":
      case "xls":
        baseQuestions.push(
          {
            title: "Please provide feedback on the data provided",
            type: "paragraph",
            required: false,
            options: [],
          },
          {
            title: "How accurate is the data in this file?",
            type: "scale",
            required: false,
            options: [],
            low: 1,
            high: 5,
            lowLabel: "Not accurate",
            highLabel: "Very accurate",
          }
        );
        break;

      case "txt":
        baseQuestions.push({
          title: "Please provide your thoughts on the text content",
          type: "paragraph",
          required: false,
          options: [],
        });
        break;

      default:
        baseQuestions.push({
          title: "Please provide feedback on the uploaded file",
          type: "paragraph",
          required: false,
          options: [],
        });
    }

    return baseQuestions;
  }

  // Generate a meaningful title from filename
  generateTitleFromFilename(fileName) {
    // Remove file extension and clean up the name
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
    // Replace underscores and hyphens with spaces, capitalize words
    const title = nameWithoutExt
      .replace(/[_-]/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

    return title || "Uploaded Form";
  }

  // Create form from uploaded file
  async createFormFromUpload({ filePath, fileName, createdBy }) {
    try {
      const extractedData = await this.extractDataFromFile({
        filePath,
        fileName,
      });

      // Assign a guaranteed unique googleFormId
      const googleFormId =
        "uploaded__" + new mongoose.Types.ObjectId().toHexString();
      const form = new Form({
        title: extractedData.title,
        description: extractedData.description,
        questions: extractedData.questions,
        status: "draft",
        createdBy: createdBy,
        googleFormId: googleFormId,
        uploadedFiles: extractedData.uploadedFiles,
      });
      await form.save();
      return form;
    } catch (error) {
      console.error("Error creating form from upload:", error);
      throw error;
    }
  }

  // Extract data from Google Forms URL without creating form
  async extractDataFromUrl({ url, createdBy }) {
    try {
      let finalUrl = url;
      // Handle shortened Google Forms URLs
      if (url.includes("forms.gle")) {
        try {
          const response = await axios.head(url, {
            maxRedirects: 5, // follow up to 5 redirects
          });
          finalUrl = response.request.res.responseUrl;
        } catch (error) {
          throw new Error("Could not resolve shortened Google Forms URL");
        }
      }
      // Extract form ID from Google Forms URL - support multiple URL formats
      let formIdMatch = finalUrl.match(/\/forms\/d\/e\/([a-zA-Z0-9-_]+)/);
      if (!formIdMatch) {
        // Try standard format: /forms/d/[formId]
        formIdMatch = finalUrl.match(/\/forms\/d\/([a-zA-Z0-9-_]+)/);
      }
      if (!formIdMatch) {
        // Try docs.google.com format
        formIdMatch = finalUrl.match(
          /docs\.google\.com\/forms\/d\/([a-zA-Z0-9-_]+)/
        );
      }
      if (!formIdMatch) {
        // Try direct formId pattern
        formIdMatch = finalUrl.match(/([a-zA-Z0-9-_]{20,})/);
      }
      if (!formIdMatch) {
        throw new Error("Invalid Google Forms URL");
      }
      const formId = formIdMatch[1];
      // Check if form with this googleFormId already exists
      const existingForm = await Form.findOne({ googleFormId: formId });
      if (existingForm) {
        throw new Error("This Google Form has already been imported");
      }

      // Try to use Google Forms API if available, otherwise fall back to HTML scraping
      let formTitle = "Imported Google Form";
      let formDescription = "Form imported from Google Forms";
      let extractedQuestions = [];

      try {
        // For this implementation, we'll use a pragmatic approach:
        // 1. Try the official Google Forms API if credentials are available (not implemented yet)
        // 2. Fall back to HTML scraping with improved logic
        // 3. If all fails, return empty questions (better than wrong questions)

        // For now, implement a robust HTML scraping approach based on the paper's requirements
        // The paper mentions supporting Google Forms integration, so we need to make this work

        console.log(
          `🔍 [Google Forms Extraction] Fetching form from: ${finalUrl}`
        );
        console.log(`🔍 [Google Forms Extraction] Form ID: ${formId}`);

        // Attempt to fetch form metadata from Google Forms
        const response = await axios.get(finalUrl, {
          timeout: 15000,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Cache-Control": "max-age=0",
            "Sec-Ch-Ua":
              '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
          },
          maxRedirects: 5,
        });

        const html = response.data;
        console.log(
          `✅ [Google Forms Extraction] Successfully fetched HTML (${html.length} characters)`
        );

        // Extract title and description from HTML directly

        // Fallback to HTML extraction if not found in data
        if (!formTitle || formTitle === "Imported Google Form") {
          const titleMatch = html.match(/<title>(.*?)<\/title>/i);
          if (titleMatch && titleMatch[1]) {
            formTitle = titleMatch[1].replace(/ - Google Forms$/, "").trim();
          }
        }

        if (
          !formDescription ||
          formDescription === "Form imported from Google Forms"
        ) {
          const descMatch = html.match(
            /<meta name="description" content="(.*?)"/i
          );
          if (descMatch && descMatch[1]) {
            formDescription = descMatch[1];
          }
        }

        // Try to extract questions using the original manual parsing approach

        try {
          // Strategy 1: Look for FB_PUBLIC_LOAD_DATA scripts (most common)
          const scriptRegex =
            /<script[^>]*>[\s\S]*?FB_PUBLIC_LOAD_DATA_[\s\S]*?<\/script>/gi;
          const scriptMatches = html.match(scriptRegex);

          if (scriptMatches) {
            for (const scriptTag of scriptMatches) {
              try {
                // Extract the JSON array from the script tag
                let dataMatch = scriptTag.match(
                  /FB_PUBLIC_LOAD_DATA_[^=]*=\s*(\[[\s\S]*?\]);/
                );
                if (!dataMatch) {
                  // Try alternative pattern
                  dataMatch = scriptTag.match(/(\[[\s\S]*?\])\s*;\s*$/);
                }

                if (dataMatch && dataMatch[1]) {
                  const parsedData = JSON.parse(dataMatch[1]);

                  if (Array.isArray(parsedData) && parsedData.length > 1) {
                    // Questions are typically in parsedData[1]
                    const questionsData = parsedData[1];

                    if (Array.isArray(questionsData)) {
                      extractedQuestions = [];
                      let currentSection = null;
                      let sectionCounter = 0;

                      for (let i = 0; i < questionsData.length; i++) {
                        const q = questionsData[i];
                        try {
                          // Handle different Google Forms question structures
                          if (Array.isArray(q) && q.length >= 2) {
                            let questionFound = false;

                            // Check if this is a section header (type might be different)
                            if (Array.isArray(q[1]) && q[1].length > 1) {
                              const qData = q[1];
                              const title = qData[1];
                              const questionType = qData[3] || 0;

                              // Type 8 or other indicators might be sections
                              if (
                                questionType === 8 ||
                                (title &&
                                  typeof title === "string" &&
                                  title.trim().length > 0 &&
                                  (title.toLowerCase().includes("section") ||
                                    title.toLowerCase().includes("page") ||
                                    questionType === 8))
                              ) {
                                // This is a section
                                currentSection = title.trim();
                                sectionCounter++;
                                continue; // Skip adding as question
                              }
                            }

                            // Strategy 1: Standard structure [id, [title, required, type, options, ...]]
                            if (Array.isArray(q[1]) && q[1].length > 1) {
                              const qData = q[1];
                              const title = qData[1];
                              const isRequired = qData[2] === 1;
                              const questionType = qData[3] || 0;

                              if (
                                title &&
                                typeof title === "string" &&
                                title.trim().length > 0 &&
                                questionType !== 8
                              ) {
                                // Skip section headers

                                // Skip common name and email questions that Google Forms often includes
                                const lowerTitle = title.toLowerCase().trim();
                                const skipPatterns = [
                                  /^name$/i,
                                  /^full name$/i,
                                  /^your name$/i,
                                  /^email$/i,
                                  /^email address$/i,
                                  /^your email$/i,
                                  /^e-mail$/i,
                                  /^contact email$/i,
                                  /^what is your name/i,
                                  /^what's your name/i,
                                  /^enter your name/i,
                                  /^please enter your name/i,
                                ];

                                const shouldSkip = skipPatterns.some(
                                  (pattern) => pattern.test(lowerTitle)
                                );
                                if (shouldSkip) {
                                  continue;
                                }

                                // Extract options for multiple choice questions
                                let options = [];
                                if (qData[4] && Array.isArray(qData[4])) {
                                  let rawOptions = qData[4];
                                  // Check for nested options array [[["Opt1"], ["Opt2"]]] which happens in some form versions
                                  if (
                                    rawOptions.length === 1 &&
                                    Array.isArray(rawOptions[0]) &&
                                    rawOptions[0].length > 0 &&
                                    Array.isArray(rawOptions[0][0])
                                  ) {
                                    rawOptions = rawOptions[0];
                                  }

                                  options = rawOptions
                                    .map((opt) =>
                                      Array.isArray(opt)
                                        ? (opt[0] || "").trim()
                                        : String(opt).trim()
                                    )
                                    .filter((opt) => opt && opt.length > 0);
                                }

                                // Handle scale questions - extract scale parameters
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
                                  3: "multiple_choice", // Checkboxes
                                  4: "multiple_choice", // Dropdown
                                  5: "scale",
                                  6: "multiple_choice", // Multiple choice grid
                                  7: "multiple_choice", // Checkbox grid
                                  9: "date",
                                  10: "time",
                                };

                                extractedQuestions.push({
                                  title: title.trim(),
                                  type:
                                    questionTypeMap[questionType] ||
                                    "short_answer",
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
                                questionFound = true;
                              }
                            }

                            // Strategy 2: Alternative structure [null, "question text", null, type, options]
                            if (
                              !questionFound &&
                              q[1] &&
                              typeof q[1] === "string" &&
                              q[1].trim()
                            ) {
                              const title = q[1].trim();

                              const questionTypeMap = {
                                0: "short_answer",
                                1: "paragraph",
                                2: "multiple_choice",
                                3: "multiple_choice", // Checkboxes
                                4: "multiple_choice", // Dropdown
                                5: "scale",
                                6: "multiple_choice", // Multiple choice grid
                                7: "multiple_choice", // Checkbox grid
                                9: "date",
                                10: "time",
                              };

                              // Extract options
                              let options = [];
                              if (q[4] && Array.isArray(q[4])) {
                                options = q[4]
                                  .map((opt) =>
                                    Array.isArray(opt) ? opt[0] : opt
                                  )
                                  .filter(
                                    (opt) => opt && typeof opt === "string"
                                  );
                              }

                              extractedQuestions.push({
                                title: title,
                                type:
                                  questionTypeMap[q[3] || 0] || "short_answer",
                                required: false,
                                options: options,
                                section:
                                  currentSection ||
                                  `Section ${sectionCounter || 1}`,
                                low: 1,
                                high: 5,
                                lowLabel: "Poor",
                                highLabel: "Excellent",
                              });
                              questionFound = true;
                            }
                          }

                          // Strategy 3: Handle string-only questions (less common but possible)
                          else if (
                            typeof q === "string" &&
                            q.trim() &&
                            !Array.isArray(q)
                          ) {
                            // Only add if it's clearly a question-like string
                            const trimmed = q.trim();
                            if (
                              trimmed.length > 3 &&
                              trimmed.length < 200 &&
                              !trimmed.includes("@") &&
                              !trimmed.includes("http") &&
                              !trimmed.match(/^event.*address/i) &&
                              !trimmed.match(/^contact.*us/i)
                            ) {
                              extractedQuestions.push({
                                title: trimmed,
                                type: "short_answer",
                                required: false,
                                options: [],
                                section:
                                  currentSection ||
                                  `Section ${sectionCounter || 1}`,
                                low: 1,
                                high: 5,
                                lowLabel: "Poor",
                                highLabel: "Excellent",
                              });
                            }
                          }
                        } catch (questionError) {
                          continue;
                        }
                      }

                      // Filter out any remaining nulls and duplicates
                      extractedQuestions = extractedQuestions.filter(
                        (q) => q !== null
                      );

                      if (extractedQuestions.length > 0) {
                        break; // Found questions, stop processing
                      }
                    }
                  }
                }
              } catch (parseError) {
                continue;
              }
            }
          }
        } catch (parsingError) {
          extractedQuestions = [];

          // Fallback to enhanced web scraping if script parsing fails
          try {
            const $ = cheerio.load(html);

            // Enhanced selectors for different Google Forms versions
            const questionSelectors = [
              ".freebirdFormviewerComponentsQuestionBaseRoot",
              "[data-item-id]",
              ".freebirdFormviewerViewItemsItemItem",
              '[jsname="ibnC6b"]',
              ".exportContent",
              ".freebirdFormviewerComponentsQuestionBaseTitle",
              '[role="listitem"]',
              ".question",
            ];

            let allQuestions = [];

            // First, try to extract header/intro blocks (colored blocks on the left)
            const headerBlocks = [];
            const headerSelectors = [
              ".freebirdFormviewerViewHeaderCard",
              ".freebirdFormviewerViewFormCard",
              '[data-card-type="header"]',
              ".freebirdFormviewerViewHeaderTitleRow",
              ".freebirdFormviewerViewHeaderDescription",
            ];

            headerSelectors.forEach((selector) => {
              $(selector).each((index, element) => {
                const $elem = $(element);
                const headerText = $elem.text().trim();

                if (
                  headerText &&
                  headerText.length > 0 &&
                  headerText.length < 1000
                ) {
                  // Check if it looks like a header/intro
                  const lowerText = headerText.toLowerCase();
                  if (
                    !lowerText.includes("submit") &&
                    !lowerText.includes("privacy") &&
                    !lowerText.includes("terms") &&
                    !lowerText.match(/^\d+\./)
                  ) {
                    headerBlocks.push({
                      type: "header",
                      title: headerText,
                      section: "Intro",
                    });
                  }
                }
              });
            });

            // Extract sections from colored left blocks
            const sections = [];
            const sectionSelectors = [
              ".freebirdFormviewerViewSectionCard",
              '[data-card-type="section"]',
              ".freebirdFormviewerViewSectionTitle",
            ];

            sectionSelectors.forEach((selector) => {
              $(selector).each((index, element) => {
                const $elem = $(element);
                const sectionTitle =
                  $elem
                    .find(
                      ".freebirdFormviewerViewSectionTitle, h2, .section-title"
                    )
                    .first()
                    .text()
                    .trim() || $elem.text().trim();

                if (
                  sectionTitle &&
                  sectionTitle.length > 0 &&
                  sectionTitle.length < 200
                ) {
                  // Check if it looks like a section title
                  const lowerTitle = sectionTitle.toLowerCase();
                  if (
                    !lowerTitle.includes("submit") &&
                    !lowerTitle.includes("privacy") &&
                    !lowerTitle.includes("terms") &&
                    !lowerTitle.match(/^\d+\./)
                  ) {
                    sections.push({
                      title: sectionTitle,
                      index: sections.length + 1,
                    });
                  }
                }
              });
            });

            // Try each selector and collect questions
            let currentSectionIndex = 0;
            questionSelectors.forEach((selector) => {
              $(selector).each((index, element) => {
                const $elem = $(element);

                // Extract question text with multiple fallbacks
                let questionText = "";
                const textSelectors = [
                  ".freebirdFormviewerComponentsQuestionBaseTitle",
                  '[role="heading"]',
                  '[jsname="V67aGc"]',
                  ".exportContent",
                  ".question-title",
                  "div[role='heading']",
                  "span",
                  "div",
                  "label",
                ];

                for (const textSel of textSelectors) {
                  const textElem = $elem.find(textSel).first();
                  if (textElem.length > 0 && textElem.text().trim()) {
                    questionText = textElem.text().trim();
                    break;
                  }
                }

                // If no text found, try the element itself
                if (!questionText) {
                  questionText = $elem.text().trim();
                }

                // Skip if empty or too short
                if (!questionText || questionText.length < 2) {
                  return;
                }

                // Skip common non-question elements
                const lowerText = questionText.toLowerCase();
                if (
                  lowerText.includes("submit") ||
                  lowerText.includes("next") ||
                  lowerText.includes("previous") ||
                  lowerText.includes("required") ||
                  lowerText.includes("privacy") ||
                  lowerText.includes("terms") ||
                  lowerText.match(/^\d+\.$/) || // Just numbers
                  lowerText.length > 500
                ) {
                  // Too long
                  return;
                }

                // Enhanced question type and options detection
                let questionType = "short_answer";
                let options = [];
                let allowMultipleSelection = false;

                // Analyze form elements with priority-based detection
                const inputs = $elem.find("input, select, textarea");
                const hasTextarea = $elem.find("textarea").length > 0;
                const hasSelect = $elem.find("select").length > 0;
                const hasRadio = $elem.find('input[type="radio"]').length > 0;
                const hasCheckbox =
                  $elem.find('input[type="checkbox"]').length > 0;
                const hasScale =
                  $elem.find(
                    '.freebirdFormviewerComponentsQuestionScaleSlider, [role="radiogroup"]'
                  ).length > 0;
                const hasDate = $elem.find('input[type="date"]').length > 0;
                const hasTime = $elem.find('input[type="time"]').length > 0;

                // Determine question type with priority (most specific first)
                if (hasTextarea) {
                  questionType = "paragraph";
                } else if (hasScale) {
                  questionType = "scale";
                } else if (hasDate) {
                  questionType = "date";
                } else if (hasTime) {
                  questionType = "time";
                } else if (hasSelect) {
                  questionType = "multiple_choice";
                  // Extract select options precisely
                  $elem.find("select option").each((j, option) => {
                    const $option = $(option);
                    const optText = $option.text().trim();
                    const optValue = $option.attr("value");

                    // Skip placeholder options
                    if (
                      optText &&
                      !optText.match(/^(choose|select|please select)/i) &&
                      !optText.includes("...") &&
                      optValue !== ""
                    ) {
                      options.push(optText);
                    }
                  });
                } else if (hasRadio) {
                  questionType = "multiple_choice";
                  allowMultipleSelection = false;
                } else if (hasCheckbox) {
                  questionType = "multiple_choice";
                  allowMultipleSelection = true; // Checkboxes allow multiple selection
                }

                // Extract options for radio buttons with enhanced accuracy
                if (hasRadio) {
                  const radioOptions = [];
                  const radioGroups = {};

                  $elem.find('input[type="radio"]').each((i, radio) => {
                    const $radio = $(radio);
                    const radioName = $radio.attr("name") || `radio-group-${i}`;
                    const radioValue = $radio.attr("value") || i.toString();

                    // Find associated label with multiple strategies
                    let label = "";

                    // Strategy 0: Common Google Forms class
                    const container = $radio.closest(
                      ".docssharedWizToggleLabeledContainer"
                    );
                    if (container.length > 0) {
                      label = container
                        .find(".docssharedWizToggleLabeledLabelText")
                        .text()
                        .trim();
                    }

                    // Strategy 1: aria-labelledby
                    const ariaLabelledBy = $radio.attr("aria-labelledby");
                    if (ariaLabelledBy) {
                      label = $elem.find(`#${ariaLabelledBy}`).text().trim();
                    }

                    // Strategy 2: Associated label element
                    if (!label) {
                      const labelId = $radio.attr("id");
                      if (labelId) {
                        label = $elem
                          .find(`label[for="${labelId}"]`)
                          .text()
                          .trim();
                      }
                    }

                    // Strategy 3: Same container text
                    if (!label) {
                      const $container = $radio.closest(
                        ".freebirdFormviewerComponentsQuestionRadioChoice, div"
                      );
                      const containerText = $container.text().trim();
                      if (containerText && containerText !== questionText) {
                        // Extract only the option text, not the question
                        const questionIndex = containerText
                          .toLowerCase()
                          .indexOf(questionText.toLowerCase());
                        if (questionIndex !== -1) {
                          label = containerText
                            .substring(questionIndex + questionText.length)
                            .trim();
                        } else {
                          label = containerText;
                        }
                      }
                    }

                    // Strategy 4: Next text elements
                    if (!label) {
                      label = $radio
                        .parent()
                        .contents()
                        .filter(function () {
                          return this.nodeType === 3 && $(this).text().trim();
                        })
                        .first()
                        .text()
                        .trim();
                    }

                    // Clean up the label
                    if (label) {
                      label = label.replace(/\*/g, "").trim(); // Remove asterisks
                      label = label.replace(/\n/g, " ").trim(); // Replace newlines with spaces

                      // Avoid duplicating the question text
                      if (
                        label.toLowerCase().includes(questionText.toLowerCase())
                      ) {
                        const questionWords = questionText
                          .toLowerCase()
                          .split(/\s+/);
                        const labelWords = label.toLowerCase().split(/\s+/);
                        label = labelWords
                          .filter(
                            (word) =>
                              !questionWords.includes(word) || word.length < 3
                          )
                          .join(" ")
                          .trim();
                      }

                      if (
                        label &&
                        label.length > 0 &&
                        label.length < 200 &&
                        !radioGroups[radioName]?.includes(label)
                      ) {
                        if (!radioGroups[radioName]) {
                          radioGroups[radioName] = [];
                        }
                        radioGroups[radioName].push(label);
                      }
                    }
                  });

                  // Collect unique options from all radio groups
                  Object.values(radioGroups).forEach((groupOptions) => {
                    options.push(...groupOptions);
                  });

                  // Remove duplicates
                  options = [...new Set(options)];
                }

                // Extract options for checkboxes with enhanced accuracy
                if (hasCheckbox) {
                  const checkboxOptions = [];
                  const checkboxGroups = {};

                  $elem.find('input[type="checkbox"]').each((i, checkbox) => {
                    const $checkbox = $(checkbox);
                    const checkboxName =
                      $checkbox.attr("name") || `checkbox-group-${i}`;

                    // Find associated label with same strategies as radio
                    let label = "";

                    // Strategy 1: aria-labelledby
                    const ariaLabelledBy = $checkbox.attr("aria-labelledby");
                    if (ariaLabelledBy) {
                      label = $elem.find(`#${ariaLabelledBy}`).text().trim();
                    }

                    // Strategy 2: Associated label element
                    if (!label) {
                      const labelId = $checkbox.attr("id");
                      if (labelId) {
                        label = $elem
                          .find(`label[for="${labelId}"]`)
                          .text()
                          .trim();
                      }
                    }

                    // Strategy 3: Same container text
                    if (!label) {
                      const $container = $checkbox.closest(
                        ".freebirdFormviewerComponentsQuestionCheckboxChoice, div"
                      );
                      const containerText = $container.text().trim();
                      if (containerText && containerText !== questionText) {
                        const questionIndex = containerText
                          .toLowerCase()
                          .indexOf(questionText.toLowerCase());
                        if (questionIndex !== -1) {
                          label = containerText
                            .substring(questionIndex + questionText.length)
                            .trim();
                        } else {
                          label = containerText;
                        }
                      }
                    }

                    // Strategy 4: Next text elements
                    if (!label) {
                      label = $checkbox
                        .parent()
                        .contents()
                        .filter(function () {
                          return this.nodeType === 3 && $(this).text().trim();
                        })
                        .first()
                        .text()
                        .trim();
                    }

                    // Clean up the label
                    if (label) {
                      label = label.replace(/\*/g, "").trim();
                      label = label.replace(/\n/g, " ").trim();

                      // Avoid duplicating the question text
                      if (
                        label.toLowerCase().includes(questionText.toLowerCase())
                      ) {
                        const questionWords = questionText
                          .toLowerCase()
                          .split(/\s+/);
                        const labelWords = label.toLowerCase().split(/\s+/);
                        label = labelWords
                          .filter(
                            (word) =>
                              !questionWords.includes(word) || word.length < 3
                          )
                          .join(" ")
                          .trim();
                      }

                      if (
                        label &&
                        label.length > 0 &&
                        label.length < 200 &&
                        !checkboxGroups[checkboxName]?.includes(label)
                      ) {
                        if (!checkboxGroups[checkboxName]) {
                          checkboxGroups[checkboxName] = [];
                        }
                        checkboxGroups[checkboxName].push(label);
                      }
                    }
                  });

                  // Collect unique options from all checkbox groups
                  Object.values(checkboxGroups).forEach((groupOptions) => {
                    checkboxOptions.push(...groupOptions);
                  });

                  // Remove duplicates
                  options = [...new Set(checkboxOptions)];
                }

                // Extract scale parameters if it's a scale question
                let low = 1,
                  high = 5,
                  lowLabel = "Poor",
                  highLabel = "Excellent";
                if (questionType === "scale") {
                  // Try to find scale labels
                  const scaleLabels = $elem.find(
                    ".freebirdFormviewerComponentsQuestionScaleSlider label, .scale-label"
                  );
                  if (scaleLabels.length >= 2) {
                    lowLabel = $(scaleLabels[0]).text().trim() || "Poor";
                    highLabel =
                      $(scaleLabels[scaleLabels.length - 1])
                        .text()
                        .trim() || "Excellent";
                  }

                  // Count scale points (radio buttons in scale)
                  const scalePoints = $elem.find('input[type="radio"]').length;
                  if (scalePoints > 0) {
                    high = scalePoints;
                  }
                }

                // Check if required
                const isRequired =
                  $elem.text().includes("*") ||
                  $elem.find('[aria-required="true"]').length > 0 ||
                  $elem.closest('[aria-required="true"]').length > 0 ||
                  $elem.find(
                    ".freebirdFormviewerComponentsQuestionBaseRequiredAsterisk"
                  ).length > 0;

                // Skip name and email fields
                const lowerTitle = questionText.toLowerCase().trim();
                const skipPatterns = [
                  /^name$/i,
                  /^full name$/i,
                  /^your name$/i,
                  /^email$/i,
                  /^email address$/i,
                  /^your email$/i,
                  /^e-mail$/i,
                  /^what is your name/i,
                  /^what's your name/i,
                  /^enter your name/i,
                  /^please enter your name/i,
                ];

                const shouldSkip = skipPatterns.some((pattern) =>
                  pattern.test(lowerTitle)
                );
                if (shouldSkip) {
                  return;
                }

                // Determine which section this question belongs to
                let questionSection = "Section 1";
                if (sections.length > 0) {
                  // Find the closest section before this question
                  questionSection =
                    sections[Math.min(currentSectionIndex, sections.length - 1)]
                      .title;
                }

                // Create question object with all extracted data
                const questionObj = {
                  title: questionText,
                  type: questionType,
                  required: isRequired,
                  options: options,
                  section: questionSection,
                  low: low,
                  high: high,
                  lowLabel: lowLabel,
                  highLabel: highLabel,
                };

                // Add multiple selection flag for checkboxes
                if (
                  allowMultipleSelection &&
                  questionType === "multiple_choice"
                ) {
                  questionObj.allowMultipleSelection = true;
                }

                allQuestions.push(questionObj);
              });
            });

            // Remove duplicates and filter valid questions
            const uniqueQuestions = [];
            const seen = new Set();

            allQuestions.forEach((q) => {
              const key = `${q.title}-${q.type}`;
              if (
                !seen.has(key) &&
                q.title.length > 3 &&
                q.title.length < 300
              ) {
                seen.add(key);
                uniqueQuestions.push(q);
              }
            });

            extractedQuestions = uniqueQuestions;
          } catch (scrapingError) {
            extractedQuestions = [];
          }
        }
      } catch (error) {
        console.log(
          "Could not extract form details from Google Forms:",
          error.message
        );
      }

      return {
        title: formTitle,
        description: formDescription,
        questions: extractedQuestions,
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
    } catch (error) {
      console.error("Error extracting data from URL:", error);
      throw error;
    }
  }

  // Parse attendee file (CSV/Excel) and extract attendee data
  async parseAttendeeFile(filePath) {
    try {
      const attendees = [];
      const fileExtension = filePath.split(".").pop().toLowerCase();

      if (fileExtension === "csv") {
        // Parse CSV file
        return new Promise((resolve, reject) => {
          const results = [];
          fs.createReadStream(filePath)
            .pipe(csv())
            .on("data", (data) => {
              // Look for name and email columns (case insensitive)
              const nameKeys = Object.keys(data).filter(
                (key) =>
                  key.toLowerCase().includes("name") ||
                  key.toLowerCase().includes("full name") ||
                  key.toLowerCase().includes("full_name") ||
                  key.toLowerCase().includes("student name")
              );

              const emailKeys = Object.keys(data).filter(
                (key) =>
                  key.toLowerCase().includes("email") ||
                  key.toLowerCase().includes("e-mail") ||
                  key.toLowerCase().includes("email address")
              );

              const name = nameKeys.length > 0 ? data[nameKeys[0]]?.trim() : "";
              const email =
                emailKeys.length > 0 ? data[emailKeys[0]]?.trim() : "";

              if (name && email) {
                results.push({ name, email: email.toLowerCase() });
              } else if (email) {
                // If only email is present, use email as name
                results.push({
                  name: email.split("@")[0],
                  email: email.toLowerCase(),
                });
              }
            })
            .on("end", () => {
              resolve(results);
            })
            .on("error", (error) => {
              reject(error);
            });
        });
      } else if (fileExtension === "xlsx" || fileExtension === "xls") {
        // Parse Excel file
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json(worksheet);

        const results = [];
        jsonData.forEach((row) => {
          // Look for name and email columns (case insensitive)
          const nameKeys = Object.keys(row).filter(
            (key) =>
              key.toLowerCase().includes("name") ||
              key.toLowerCase().includes("full name") ||
              key.toLowerCase().includes("full_name") ||
              key.toLowerCase().includes("student name")
          );

          const emailKeys = Object.keys(row).filter(
            (key) =>
              key.toLowerCase().includes("email") ||
              key.toLowerCase().includes("e-mail") ||
              key.toLowerCase().includes("email address")
          );

          const name =
            nameKeys.length > 0 ? String(row[nameKeys[0]] || "").trim() : "";
          const email =
            emailKeys.length > 0 ? String(row[emailKeys[0]] || "").trim() : "";

          if (name && email) {
            results.push({ name, email: email.toLowerCase() });
          } else if (email) {
            // If only email is present, use email username as name
            results.push({
              name: email.split("@")[0],
              email: email.toLowerCase(),
            });
          }
        });

        return results;
      } else {
        throw new Error(
          "Unsupported file format. Only CSV and Excel files are supported."
        );
      }
    } catch (error) {
      console.error("Error parsing attendee file:", error);
      throw new Error(`Failed to parse attendee file: ${error.message}`);
    }
  }

  // Get attendee dashboard data for students
  async getAttendeeDashboard(email) {
    try {
      // Find all forms where this email is in the attendee list
      const forms = await Form.find({
        "attendeeList.email": email,
        status: "published",
      }).select(
        "title description attendeeList.$ shareableLink eventStartDate eventEndDate responses"
      );

      const dashboardData = forms.map((form) => {
        const attendeeInfo = form.attendeeList.find(
          (attendee) => attendee.email === email
        );
        const hasResponded = attendeeInfo ? attendeeInfo.hasResponded : false;

        return {
          formId: form._id,
          title: form.title,
          description: form.description,
          shareableLink: form.shareableLink,
          hasResponded: hasResponded,
          eventStartDate: form.eventStartDate,
          eventEndDate: form.eventEndDate,
          // Include response data if they have responded
          response: hasResponded
            ? form.responses.find((r) => r.respondentEmail === email)
            : null,
        };
      });

      return dashboardData;
    } catch (error) {
      console.error("Error fetching attendee dashboard:", error);
      throw error;
    }
  }

  // Create form from Google Forms URL
  async createFormFromUrl({ url, createdBy }) {
    try {
      const extractedData = await this.extractDataFromUrl({ url, createdBy });

      const form = new Form({
        title: extractedData.title,
        description: extractedData.description,
        questions: extractedData.questions,
        status: "draft",
        createdBy: createdBy,
        googleFormId: extractedData.googleFormId,
        uploadedLinks: extractedData.uploadedLinks,
      });
      await form.save();
      return form;
    } catch (error) {
      console.error("Error creating form from URL:", error);
      throw error;
    }
  }

  // Get all forms for a user
  async getUserForms(userId) {
    try {
      return await Form.find({ createdBy: userId })
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 });
    } catch (error) {
      console.error("Error fetching user forms:", error);
      throw error;
    }
  }

  // Get form by ID
  async getFormById(formId, userId) {
    try {
      const form = await Form.findOne({
        _id: formId,
        createdBy: userId,
      }).populate("createdBy", "name email");

      if (!form) {
        throw new Error("Form not found");
      }

      return form;
    } catch (error) {
      console.error("Error fetching form:", error);
      throw error;
    }
  }

  // Update form
  async updateForm(formId, userId, updateData) {
    try {
      const form = await Form.findOneAndUpdate(
        { _id: formId, createdBy: userId },
        updateData,
        { new: true }
      ).populate("createdBy", "name email");

      if (!form) {
        throw new Error("Form not found");
      }

      return form;
    } catch (error) {
      console.error("Error updating form:", error);
      throw error;
    }
  }

  // Delete form
  async deleteForm(formId, userId) {
    try {
      // First, get the form data to identify files to clean up
      const form = await Form.findOne({
        _id: formId,
        createdBy: userId,
      });

      if (!form) {
        throw new Error("Form not found");
      }

      // Clean up uploaded files from filesystem
      if (form.uploadedFiles && Array.isArray(form.uploadedFiles)) {
        for (const file of form.uploadedFiles) {
          if (file.path && fs.existsSync(file.path)) {
            try {
              fs.unlinkSync(file.path);
              console.log(`🗑️ Deleted file: ${file.path}`);
            } catch (fileError) {
              console.warn(
                `⚠️ Failed to delete file ${file.path}:`,
                fileError.message
              );
            }
          }
        }
      }

      // Clean up CSV files that were uploaded for attendee lists
      // These are typically stored in the uploads/csv directory with timestamp-based names
      if (form.uploadedLinks && Array.isArray(form.uploadedLinks)) {
        for (const link of form.uploadedLinks) {
          if (link.url && link.url.includes("/uploads/csv/")) {
            // Extract file path from URL
            const fileName = link.url.split("/").pop();
            const fullPath = path.join(
              __dirname,
              "../../../uploads/csv",
              fileName
            );

            if (fs.existsSync(fullPath)) {
              try {
                fs.unlinkSync(fullPath);
                console.log(`🗑️ Deleted CSV file: ${fullPath}`);
              } catch (csvError) {
                console.warn(
                  `⚠️ Failed to delete CSV file ${fullPath}:`,
                  csvError.message
                );
              }
            }
          }
        }
      }

      // Now delete the form from database
      await Form.findOneAndDelete({
        _id: formId,
        createdBy: userId,
      });

      console.log(
        `✅ Form ${formId} and associated files deleted successfully`
      );
      return form;
    } catch (error) {
      console.error("Error deleting form:", error);
      throw error;
    }
  }

  // Publish form
  async publishForm(formId, userId) {
    try {
      const form = await Form.findOneAndUpdate(
        { _id: formId, createdBy: userId },
        {
          status: "published",
          publishedAt: new Date(),
        },
        { new: true }
      );

      if (!form) {
        throw new Error("Form not found");
      }

      return form;
    } catch (error) {
      console.error("Error publishing form:", error);
      throw error;
    }
  }

  // Submit form response
  async submitFormResponse(formId, responseData) {
    try {
      const form = await Form.findById(formId);

      if (!form) {
        throw new Error("Form not found");
      }

      if (form.status !== "published") {
        throw new Error("Form is not available for responses");
      }

      form.responses.push(responseData);
      form.responseCount = (form.responseCount || 0) + 1;

      await form.save();
      return form;
    } catch (error) {
      console.error("Error submitting form response:", error);
      throw error;
    }
  }

  // Get form responses
  async getFormResponses(formId, userId) {
    try {
      const form = await Form.findOne({
        _id: formId,
        createdBy: userId,
      });

      if (!form) {
        throw new Error("Form not found");
      }

      return form.responses || [];
    } catch (error) {
      console.error("Error fetching form responses:", error);
      throw error;
    }
  }
}

module.exports = new FormsService();
