const Form = require("../../models/Form");
const mongoose = require("mongoose");
const axios = require("axios");
const fileParser = require("../../utils/fileParser");

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
        console.log(`Extracted ${questions.length} questions from file`);
      } catch (parseError) {
        console.log("File parsing failed:", parseError.message);
        // If parsing completely fails, we'll use fallback questions below
      }

      // If no questions were extracted from the file, use dynamic fallback based on file type
      if (!questions || questions.length === 0) {
        const fileExt = fileName.split('.').pop()?.toLowerCase();
        questions = this.generateFallbackQuestions(fileName, fileExt);
        console.log(`Using ${questions.length} fallback questions for ${fileExt} file`);
      }

      const finalData = {
        title: extractedData?.title || this.generateTitleFromFilename(fileName),
        description: extractedData?.description || `Form created from uploaded ${fileName.split('.').pop()?.toUpperCase()} file`,
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

  // Extract data from file without creating form or using fallbacks
  async extractDataFromFile({ filePath, fileName }) {
    try {
      const extractedData = await fileParser.extractQuestionsFromFile(filePath);

      const finalData = {
        title: extractedData?.title || this.generateTitleFromFilename(fileName),
        description: extractedData?.description || `Extracted from ${fileName}`,
        questions: extractedData.questions || [],
      };

      return finalData;
    } catch (error) {
      console.error(`Error extracting data from file ${fileName}:`, error);
      // Re-throw the error to be handled by the controller
      throw error;
    }
  }

  // Generate appropriate fallback questions based on file type
  generateFallbackQuestions(fileName, fileExt) {
    const baseQuestions = [];

    switch (fileExt) {
      case 'pdf':
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

      case 'docx':
      case 'doc':
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

      case 'csv':
      case 'xlsx':
      case 'xls':
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

      case 'txt':
        baseQuestions.push(
          {
            title: "Please provide your thoughts on the text content",
            type: "paragraph",
            required: false,
            options: [],
          }
        );
        break;

      default:
        baseQuestions.push(
          {
            title: "Please provide feedback on the uploaded file",
            type: "paragraph",
            required: false,
            options: [],
          }
        );
    }

    return baseQuestions;
  }

  // Generate a meaningful title from filename
  generateTitleFromFilename(fileName) {
    // Remove file extension and clean up the name
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
    // Replace underscores and hyphens with spaces, capitalize words
    const title = nameWithoutExt
      .replace(/[_-]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    return title || "Uploaded Form";
  }

  // Create form from uploaded file
  async createFormFromUpload({ filePath, fileName, createdBy }) {
    try {
      const extractedData = await this.extractDataFromUpload({ filePath, fileName, createdBy });

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
      // Extract form ID from Google Forms URL - support multiple URL formats
      let formIdMatch = url.match(/\/forms\/d\/e\/([a-zA-Z0-9-_]+)/);
      if (!formIdMatch) {
        // Try standard format: /forms/d/[formId]
        formIdMatch = url.match(/\/forms\/d\/([a-zA-Z0-9-_]+)/);
      }
      if (!formIdMatch) {
        // Try docs.google.com format
        formIdMatch = url.match(/docs\.google\.com\/forms\/d\/([a-zA-Z0-9-_]+)/);
      }
      if (!formIdMatch) {
        // Try direct formId pattern
        formIdMatch = url.match(/([a-zA-Z0-9-_]{20,})/);
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

      // Try to extract the actual form title and questions from Google Forms
      let formTitle = "Imported Google Form";
      let formDescription = "Form imported from Google Forms";
      let extractedQuestions = [];

      try {
        // Attempt to fetch form metadata from Google Forms
        const response = await axios.get(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });

        const html = response.data;

        // Extract title from HTML
        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          formTitle = titleMatch[1].replace(/ - Google Forms$/, '').trim();
        }

        // Extract description if available
        const descMatch = html.match(/<meta name="description" content="(.*?)"/i);
        if (descMatch && descMatch[1]) {
          formDescription = descMatch[1];
        }

        // Try to extract questions from the HTML
        // Look for the JSON data in the HTML that contains form structure
        try {
          // Look for the specific script tag that contains form data
          const scriptRegex = /<script[^>]*>[\s\S]*?FB_PUBLIC_LOAD_DATA_[\s\S]*?<\/script>/gi;
          const scriptMatches = html.match(scriptRegex);

          if (scriptMatches) {
            for (const scriptTag of scriptMatches) {
              try {
                // Extract the JSON array from the script tag
                const dataMatch = scriptTag.match(/FB_PUBLIC_LOAD_DATA_[^=]*=\s*(\[[\s\S]*?\]);/);
                if (dataMatch && dataMatch[1]) {
                  const parsedData = JSON.parse(dataMatch[1]);

                  if (Array.isArray(parsedData) && parsedData.length > 1) {
                    // Extract questions from the parsed data
                    const questionsData = parsedData[1];
                    if (Array.isArray(questionsData)) {
                      extractedQuestions = questionsData.map(q => {
                        if (q && Array.isArray(q) && q.length > 1) {
                          const questionData = q[1];
                          if (questionData && Array.isArray(questionData) && questionData.length > 3) {
                            const title = questionData[1] || "Untitled Question";
                            const type = mapGoogleFormType(questionData[3] || 0);
                            const required = questionData[2] === 1;
                            let options = [];

                            // Extract options for multiple choice, checkboxes, etc.
                            if (questionData[4] && Array.isArray(questionData[4])) {
                              // Copy every choice exactly as it appears in Google Forms
                              options = questionData[4].map(opt => {
                                if (Array.isArray(opt)) {
                                  // Google Forms stores options as [text, value] pairs
                                  // We want to preserve the exact text that users see
                                  return opt[0] || "";
                                }
                                // Handle direct string options (fallback)
                                return opt || "";
                              }).filter(opt => opt !== null && opt !== undefined && opt !== "");
                            }

                            // Handle scale questions - copy exact scale configuration from Google Forms
                            let low = 1, high = 5, lowLabel = "Poor", highLabel = "Excellent";
                            if (type === "scale" && questionData[4] && Array.isArray(questionData[4]) && questionData[4].length >= 2) {
                              const scaleData = questionData[4];
                              if (scaleData[0] && Array.isArray(scaleData[0])) {
                                // Copy exact low and high values
                                low = scaleData[0][0] || 1;
                                high = scaleData[0][1] || 5;
                              }
                              if (scaleData[1] && Array.isArray(scaleData[1])) {
                                // Copy exact labels
                                lowLabel = scaleData[1][0] || "Poor";
                                highLabel = scaleData[1][1] || "Excellent";
                              }
                            }

                            // Return question with exact choices copied from Google Forms
                            return {
                              title: title,
                              type: type,
                              required: required,
                              options: options, // Contains all choices exactly as in Google Forms
                              low: low,
                              high: high,
                              lowLabel: lowLabel,
                              highLabel: highLabel,
                            };
                          }
                        }
                        return null;
                      }).filter(q => q !== null);

                      if (extractedQuestions.length > 0) {
                        console.log(`Successfully extracted ${extractedQuestions.length} questions from Google Form`);
                        break; // Found questions, stop processing
                      }
                    }
                  }
                }
              } catch (parseError) {
                // Skip this script tag if parsing fails
                continue;
              }
            }
          }
        } catch (error) {
          console.log("Error during question extraction:", error.message);
        }

     } catch (error) {
       console.log("Could not extract form details from Google Forms, using defaults:", error.message);
     }

     // If no questions were extracted, use sample questions
     // Note: In a perfect implementation, we would try to extract questions from uploaded files too
     if (extractedQuestions.length === 0) {
       extractedQuestions = [
         {
           title: "How would you rate the event overall?",
           type: "scale",
           required: true,
           options: [],
           low: 1,
           high: 5,
           lowLabel: "Poor",
           highLabel: "Excellent",
         },
         {
           title: "What did you like most about the event?",
           type: "paragraph",
           required: false,
           options: [],
         },
         {
           title: "Would you attend similar events in the future?",
           type: "multiple_choice",
           required: true,
           options: ["Definitely", "Probably", "Maybe", "Probably not", "Definitely not"],
         },
       ];
     }

      return {
        title: formTitle,
        description: formDescription,
        questions: extractedQuestions,
        googleFormId: formId,
        uploadedLinks: [
          {
            title: "Original Google Form",
            url: url,
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
// Helper function to map Google Forms question types to our system
function mapGoogleFormType(googleType) {
  switch (googleType) {
    case 0: // Short answer
      return "short_answer";
    case 1: // Paragraph
      return "paragraph";
    case 2: // Multiple choice
      return "multiple_choice";
    case 3: // Checkboxes
      return "multiple_choice"; // Map to multiple choice for now
    case 4: // Dropdown
      return "multiple_choice";
    case 5: // Linear scale
      return "scale";
    case 6: // Multiple choice grid
      return "multiple_choice";
    case 7: // Checkbox grid
      return "multiple_choice";
    case 9: // Date
      return "date";
    case 10: // Time
      return "time";
    default:
      return "short_answer";
  }
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
      const form = await Form.findOneAndDelete({
        _id: formId,
        createdBy: userId,
      });

      if (!form) {
        throw new Error("Form not found");
      }

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
