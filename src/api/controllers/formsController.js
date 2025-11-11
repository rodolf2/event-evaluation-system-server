const Form = require("../../models/Form");
const User = require("../../models/User"); // Import User model
const formsService = require("../../services/forms/formsService");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads/forms");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "file-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Allowed types: PDF, DOC, DOCX, CSV, XLS, XLSX, TXT"
        ),
        false
      );
    }
  },
});

const attendeeUpload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for attendee lists
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only CSV and Excel files are allowed for attendee lists."
        ),
        false
      );
    }
  },
});

// GET /api/forms - Get all forms for the authenticated user
const getAllForms = async (req, res) => {
  try {
    const forms = await Form.find({ createdBy: req.user._id })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: forms,
    });
  } catch (error) {
    console.error("Error fetching forms:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch forms",
      error: error.message,
    });
  }
};

// GET /api/forms/:id - Get a specific form by ID
const getFormById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userEmail = req.user.email ? req.user.email.toLowerCase().trim() : "";

    let form;

    // First, try to find form created by the current user (creator access)
    form = await Form.findOne({
      _id: id,
      createdBy: userId,
    }).populate("createdBy", "name email");

    // If not found and user is a participant, check if they're assigned to the form
    if (!form && req.user.role === "participant") {
      form = await Form.findOne({
        _id: id,
        status: "published",
        "attendeeList.email": userEmail,
      }).populate("createdBy", "name email");
    }

    // If still not found, check if user has any role and is assigned to the form
    if (!form) {
      form = await Form.findOne({
        _id: id,
        status: "published",
        "attendeeList.email": userEmail,
      }).populate("createdBy", "name email");
    }

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found or you don't have permission to view it",
      });
    }

    res.status(200).json({
      success: true,
      data: form,
    });
  } catch (error) {
    console.error("Error fetching form:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch form",
      error: error.message,
    });
  }
};

/**
 * POST /api/forms/blank
 * Create a new draft form for the authenticated creator.
 * Used as the initial entity for Google Forms–style autosave.
 */
const createBlankForm = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const formData = {
      title: req.body.title || "Untitled Form",
      description: req.body.description || "Form Description",
      questions: req.body.questions || [],
      status: "draft",
      createdBy: req.user._id,
      uploadedFiles: req.body.uploadedFiles || [],
      uploadedLinks: req.body.uploadedLinks || [],
      eventStartDate: req.body.eventStartDate
        ? new Date(req.body.eventStartDate)
        : null,
      eventEndDate: req.body.eventEndDate
        ? new Date(req.body.eventEndDate)
        : null,
    };

    const form = new Form(formData);
    const savedForm = await form.save();

    // Log activity
    try {
      const activityService = require("../../services/activityService");
      await activityService.logFormCreated(req.user._id, savedForm.title, req);
    } catch (activityError) {
      console.error("Failed to log form creation activity:", activityError);
    }

    // Process selected students if provided, otherwise fall back to CSV processing
    const selectedStudents = req.body.selectedStudents;
    if (
      selectedStudents &&
      Array.isArray(selectedStudents) &&
      selectedStudents.length > 0
    ) {
      try {
        // Convert selected students to attendeeList format
        const attendeeList = await Promise.all(
          selectedStudents.map(async (student) => {
            // Normalize email for consistency
            const normalizedEmail = student.email
              ? student.email.toLowerCase().trim()
              : "";

            let user = await User.findOne({ email: normalizedEmail });

            if (!user) {
              // Create new user if not found
              user = new User({
                name: student.name
                  ? student.name.trim()
                  : normalizedEmail
                  ? normalizedEmail.split("@")[0].trim()
                  : "Unknown",
                email: normalizedEmail,
                role: "participant", // Default role for imported attendees
              });
              await user.save();
            }

            return {
              userId: user._id,
              name: student.name ? student.name.trim() : user.name,
              email: normalizedEmail,
              hasResponded: false,
              uploadedAt: new Date(),
            };
          })
        );

        // Update form with attendee list
        savedForm.attendeeList = attendeeList;
        await savedForm.save();

        console.log(
          `Added ${attendeeList.length} selected students to form attendee list`
        );
      } catch (selectedStudentsError) {
        console.error(
          "Error processing selected students:",
          selectedStudentsError
        );
        // Log the error but don't fail the form creation
      }
    } else {
      // Fallback: Process uploaded CSV files to extract attendee data (legacy behavior)
      if (Array.isArray(uploadedLinks) && uploadedLinks.length > 0) {
        try {
          for (const link of uploadedLinks) {
            if (link.url && link.url.includes(".csv")) {
              // Extract file path from URL
              const fileName = link.url.split("/").pop();
              const fullPath = path.join(
                __dirname,
                "../../../uploads/csv",
                fileName
              );

              const parsedAttendees = await formsService.parseAttendeeFile(
                fullPath
              );

              if (parsedAttendees.length > 0) {
                // Convert parsed attendees to attendeeList format with normalized emails
                const attendeeList = parsedAttendees.map((attendee) => ({
                  userId: null, // Will be populated when users respond
                  name: attendee.name || "",
                  email: attendee.email
                    ? attendee.email.toLowerCase().trim()
                    : "",
                  hasResponded: false,
                  uploadedAt: new Date(),
                }));

                // Validate attendee data
                const validAttendees = attendeeList.filter(
                  (attendee) =>
                    attendee.name.trim() !== "" && attendee.email.includes("@")
                );

                if (validAttendees.length > 0) {
                  // Update form with attendee list
                  savedForm.attendeeList = validAttendees;
                  await savedForm.save();
                  break; // Only process the first CSV file
                } else {
                  console.warn(
                    "No valid attendees found in CSV after filtering"
                  );
                }
              }
            }
          }
        } catch (csvError) {
          console.error("Error processing CSV file:", csvError);
          // Log the error but don't fail the form creation
        }
      }
    }

    res.status(201).json({
      success: true,
      message: "Draft form created successfully",
      data: { form: savedForm },
    });
  } catch (error) {
    console.error("Error creating form:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to create form",
      error: error.message,
    });
  }
};

/**
 * PATCH /api/forms/:id/draft
 * Autosave/update form content (draft or published).
 * - Only creator can update.
 * - Allowed for both draft and published forms (allows editing published forms).
 * - Supports partial updates; acts as idempotent autosave target.
 * - Does not affect existing responses/submissions.
 */
const updateDraftForm = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const form = await Form.findOne({
      _id: id,
      createdBy: req.user._id,
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Draft form not found",
      });
    }

    // Allow autosave for both draft and published forms
    // This allows editing of published forms without affecting existing responses
    if (form.status !== "draft" && form.status !== "published") {
      return res.status(400).json({
        success: false,
        message: "Only draft or published forms can be updated via autosave",
      });
    }

    const updatableFields = [
      "title",
      "description",
      "questions",
      "sections",
      "clientQuestions",
      "uploadedFiles",
      "uploadedLinks",
      "eventStartDate",
      "eventEndDate",
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === "eventStartDate" || field === "eventEndDate") {
          form[field] = req.body[field] ? new Date(req.body[field]) : null;
        } else {
          form[field] = req.body[field];
        }
      }
    });

    const saved = await form.save();

    res.status(200).json({
      success: true,
      message: "Draft autosaved successfully",
      data: { form: saved },
    });
  } catch (error) {
    console.error("Error updating draft form:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update draft form",
      error: error.message,
    });
  }
};

// POST /api/forms/upload - Upload a file and create a form from it
const uploadForm = [
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      const filePath = req.file.path;
      const fileName = req.file.originalname;
      const createdBy = req.body.createdBy;

      // Create form from uploaded file
      const form = await formsService.createFormFromUpload({
        filePath,
        fileName,
        createdBy,
      });

      res.status(201).json({
        success: true,
        message: "Form created from uploaded file",
        data: { form },
      });
    } catch (error) {
      console.error("Error uploading form:", error);

      // Clean up uploaded file if form creation failed
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error("Error cleaning up file:", cleanupError);
        }
      }

      res.status(500).json({
        success: false,
        message: "Failed to create form from upload",
        error: error.message,
      });
    }
  },
];

// POST /api/forms/extract-by-file - Extract questions from an uploaded file without creating a form
const extractFormByFile = [
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      const filePath = req.file.path;
      const fileName = req.file.originalname;

      // Extract data from the file without creating a database entry
      const extractedData = await formsService.extractDataFromFile({
        filePath,
        fileName,
      });

      // Clean up the uploaded file after successful extraction
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupError) {
        console.error("Error cleaning up extracted file:", cleanupError);
      }

      res.status(200).json({
        success: true,
        message: "File data extracted successfully",
        data: extractedData,
      });
    } catch (error) {
      console.error("Error extracting from file:", error);

      // Clean up the file on failure
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error("Error cleaning up file on failure:", cleanupError);
        }
      }

      res.status(500).json({
        success: false,
        message: "Failed to extract data from file",
        error: error.message,
      });
    }
  },
];

// POST /api/forms/extract-by-url - Extract data from Google Forms URL without creating form
const extractFormByUrl = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "URL is required",
      });
    }

    // Extract data from Google Forms URL without creating form
    const extractedData = await formsService.extractDataFromUrl({
      url,
      createdBy: req.user._id,
    });

    res.status(200).json({
      success: true,
      message: "Form data extracted successfully",
      data: extractedData,
    });
  } catch (error) {
    console.error("Error extracting form from URL:", error);

    // Handle specific error cases
    if (error.message === "This Google Form has already been imported") {
      return res.status(409).json({
        success: false,
        message:
          "This Google Form has already been imported. You can find it in your recent evaluations.",
        error: error.message,
      });
    }

    if (error.message === "Invalid Google Forms URL") {
      return res.status(400).json({
        success: false,
        message: "Invalid Google Forms URL. Please check the URL format.",
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to extract form from URL",
      error: error.message,
    });
  }
};

// POST /api/forms/upload-by-url - Upload a Google Forms URL and create a form from it
const uploadFormByUrl = async (req, res) => {
  try {
    const { url, createdBy } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "URL is required",
      });
    }

    // Create form from Google Forms URL
    const form = await formsService.createFormFromUrl({
      url,
      createdBy,
    });

    res.status(201).json({
      success: true,
      message: "Form created from Google Forms URL",
      data: { form },
    });
  } catch (error) {
    console.error("Error creating form from URL:", error);

    // Handle specific error cases
    if (error.message === "This Google Form has already been imported") {
      return res.status(409).json({
        success: false,
        message:
          "This Google Form has already been imported. You can edit the existing form instead.",
        error: error.message,
      });
    }

    if (error.message === "Invalid Google Forms URL") {
      return res.status(400).json({
        success: false,
        message: "Invalid Google Forms URL. Please check the URL format.",
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create form from URL",
      error: error.message,
    });
  }
};

/**
 * PATCH /api/forms/:id/publish
 * Transition a draft form to published and generate shareable link.
 * - Only creator can publish.
 * - Requires at least one question.
 * - Once published, visible to participants via existing queries.
 */
const publishForm = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      questions,
      eventStartDate,
      eventEndDate,
      uploadedFiles,
      uploadedLinks,
      selectedStudents,
    } = req.body;

    const form = await Form.findOne({
      _id: id,
      createdBy: req.user._id,
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    // Validate event dates if provided
    if (eventStartDate && eventEndDate) {
      const startDate = new Date(eventStartDate);
      const endDate = new Date(eventEndDate);

      if (startDate >= endDate) {
        return res.status(400).json({
          success: false,
          message: "Event start date must be before end date",
        });
      }
      form.eventStartDate = eventStartDate;
      form.eventEndDate = eventEndDate;
    }

    // Update form with final details and publish
    if (title) {
      form.title = title;
    }
    if (description) {
      form.description = description;
    }
    if (questions) {
      form.questions = questions;
    } else {
      return res.status(400).json({
        success: false,
        message: "No questions provided in request",
      });
    }
    if (uploadedFiles) {
      form.uploadedFiles = uploadedFiles;
    }
    if (uploadedLinks) {
      form.uploadedLinks = uploadedLinks;
    }

    // Process selected students if provided
    if (
      selectedStudents &&
      Array.isArray(selectedStudents) &&
      selectedStudents.length > 0
    ) {
      try {
        // Convert selected students to attendeeList format
        const attendeeList = await Promise.all(
          selectedStudents.map(async (student) => {
            // Normalize email for consistency
            const normalizedEmail = student.email
              ? student.email.toLowerCase().trim()
              : "";

            let user = await User.findOne({ email: normalizedEmail });

            if (!user) {
              // Create new user if not found
              user = new User({
                name: student.name
                  ? student.name.trim()
                  : normalizedEmail
                  ? normalizedEmail.split("@")[0].trim()
                  : "Unknown",
                email: normalizedEmail,
                role: "participant", // Default role for imported attendees
              });
              await user.save();
            }

            return {
              userId: user._id,
              name: student.name ? student.name.trim() : user.name,
              email: normalizedEmail,
              hasResponded: false,
              uploadedAt: new Date(),
            };
          })
        );

        // Update form with attendee list
        form.attendeeList = attendeeList;
        console.log(
          `Added ${attendeeList.length} selected students to form attendee list during publish`
        );
      } catch (selectedStudentsError) {
        console.error(
          "Error processing selected students during publish:",
          selectedStudentsError
        );
        // Log the error but don't fail the form publish
      }
    }

    form.status = "published";
    form.publishedAt = new Date();

    // Generate shareable link
    const shareableLink = `${
      process.env.CLIENT_URL || "http://localhost:3000"
    }/form/${form._id}`;

    form.shareableLink = shareableLink;

    const savedForm = await form.save();

    // Log activity
    try {
      const activityService = require("../../services/activityService");
      await activityService.logFormPublished(req.user._id, savedForm.title, req);
    } catch (activityError) {
      console.error("Failed to log form publication activity:", activityError);
    }

    // Create notifications for form publication
    try {
      const notificationService = require("../../services/notificationService");
      await notificationService.notifyFormPublished(savedForm, req.user._id);
    } catch (notificationError) {
      console.error("Failed to create form publication notifications:", notificationError);
      // Don't fail the form publication if notifications fail
    }

    res.status(200).json({
      success: true,
      message: "Form published successfully",
      data: {
        form: savedForm,
        shareableLink,
      },
    });
  } catch (error) {
    console.error("📝 Error publishing form:", error);
    console.error("📝 Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to publish form",
      error: error.message,
    });
  }
};

// DELETE /api/forms/:id - Delete a form
const deleteForm = async (req, res) => {
  try {
    const { id } = req.params;

    // Use the formsService to delete form and associated files
    const form = await formsService.deleteForm(id, req.user._id);

    res.status(200).json({
      success: true,
      message: "Form and associated files deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting form:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete form",
      error: error.message,
    });
  }
};

// POST /api/forms/:id/submit - Submit responses to a form
const submitFormResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const { responses, respondentEmail, respondentName } = req.body;

    // Validate that the form exists and is published
    const form = await Form.findById(id);

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    if (form.status !== "published") {
      return res.status(400).json({
        success: false,
        message: "Form is not available for responses",
      });
    }

    // Check if form is within event date range (if dates are set)
    if (form.eventStartDate || form.eventEndDate) {
      const now = new Date();
      const startDate = form.eventStartDate
        ? new Date(form.eventStartDate)
        : null;
      const endDate = form.eventEndDate ? new Date(form.eventEndDate) : null;

      if (startDate && now < startDate) {
        return res.status(400).json({
          success: false,
          message: `This form will be available starting from ${startDate.toLocaleDateString()}`,
        });
      }

      if (endDate && now > endDate) {
        return res.status(400).json({
          success: false,
          message: `This form is no longer available. It was available until ${endDate.toLocaleDateString()}`,
        });
      }
    }

    // Create response object
    const responseData = {
      formId: id,
      responses: responses || [],
      respondentEmail: respondentEmail || null,
      respondentName: respondentName || null,
      submittedAt: new Date(),
    };

    // Add response to form
    form.responses.push(responseData);
    form.responseCount = (form.responseCount || 0) + 1;

    // Check if this respondent is in the attendee list and update their status
    if (respondentEmail) {
      const normalizedEmail = respondentEmail.toLowerCase().trim();
      const attendee = form.attendeeList.find(
        (attendee) =>
          attendee.email &&
          attendee.email.toLowerCase().trim() === normalizedEmail
      );

      if (attendee) {
        attendee.hasResponded = true;

        // Generate certificate if the attendee hasn't received one yet
        if (!attendee.certificateGenerated) {
          try {
            const certificateService = require("../../services/certificate/certificateService");
            const Event = require("../../models/Event");

            // Create or find an event for this form
            let event = await Event.findOne({ name: form.title });

            if (!event) {
              // Create a temporary event for the form
              event = new Event({
                name: form.title,
                date: form.eventStartDate || form.createdAt,
                category: "evaluation",
                description:
                  form.description || `Evaluation form: ${form.title}`,
              });
              await event.save();
            }

            // Use the student's name from attendee list for the certificate
            const certificateResult =
              await certificateService.generateCertificate(
                attendee.userId || form.createdBy, // Use attendee's userId if available, otherwise form creator
                event._id, // Use the event ID
                {
                  formId: form._id, // Link certificate to the form
                  certificateType: "completion",
                  customMessage: `For successfully completing the evaluation form: ${form.title}`,
                  sendEmail: true,
                  studentName: attendee.name, // Use the name from attendee list
                  respondentEmail: respondentEmail,
                  respondentName: respondentName,
                }
              );

            if (certificateResult.success) {
              attendee.certificateGenerated = true;
              attendee.certificateId = certificateResult.certificateId;
            }
          } catch (certError) {
            console.error(
              `Error generating certificate for ${attendee.name}:`,
              certError
            );
            // Don't fail the response submission if certificate generation fails
          }
        }
      }
    }

    await form.save();

    // Log activity for form submission
    try {
      const activityService = require("../../services/activityService");
      await activityService.logFormSubmitted(req.user._id, form.title, req);
    } catch (activityError) {
      console.error("Failed to log form submission activity:", activityError);
    }

    res.status(201).json({
      success: true,
      message: "Response submitted successfully",
    });
  } catch (error) {
    console.error("Error submitting response:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit response",
      error: error.message,
    });
  }
};

// GET /api/forms/:id/responses - Get responses for a form
const getFormResponses = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userEmail = req.user.email ? req.user.email.toLowerCase().trim() : "";

    let form;

    // First, try to find form created by the current user (creator access)
    form = await Form.findOne({
      _id: id,
      createdBy: userId,
    });

    // If not found and user is a participant, check if they're assigned to the form
    if (!form && req.user.role === "participant") {
      form = await Form.findOne({
        _id: id,
        status: "published",
        "attendeeList.email": userEmail,
      });
    }

    // If still not found, check if user has any role and is assigned to the form
    if (!form) {
      form = await Form.findOne({
        _id: id,
        status: "published",
        "attendeeList.email": userEmail,
      });
    }

    if (!form) {
      return res.status(404).json({
        success: false,
        message:
          "Form not found or you don't have permission to view its responses",
      });
    }

    res.status(200).json({
      success: true,
      data: form.responses || [],
    });
  } catch (error) {
    console.error("Error fetching responses:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch responses",
      error: error.message,
    });
  }
};

// POST /api/forms/:id/attendees - Upload attendee list for a form
const uploadAttendeeList = [
  attendeeUpload.single("attendeeFile"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No attendee file uploaded",
        });
      }

      const form = await Form.findOne({
        _id: id,
        createdBy: req.user._id,
      });

      if (!form) {
        return res.status(404).json({
          success: false,
          message: "Form not found",
        });
      }

      // Parse CSV/Excel file to extract attendee data
      const parsedAttendees = await formsService.parseAttendeeFile(
        req.file.path
      );

      const processedAttendees = await Promise.all(
        parsedAttendees.map(async (attendee) => {
          // Normalize email for consistency
          const normalizedEmail = attendee.email
            ? attendee.email.toLowerCase().trim()
            : "";

          let user = await User.findOne({ email: normalizedEmail });

          if (!user) {
            // Create new user if not found
            user = new User({
              name: attendee.name
                ? attendee.name.trim()
                : attendee.email
                ? attendee.email.split("@")[0].trim()
                : "Unknown", // Fallback name
              email: normalizedEmail,
              role: "participant", // Default role for imported attendees
            });
            await user.save();
          }

          return {
            userId: user._id,
            name: attendee.name ? attendee.name.trim() : user.name,
            email: normalizedEmail,
            hasResponded: false,
            uploadedAt: new Date(),
          };
        })
      );

      // Update form with processed attendee list
      form.attendeeList = processedAttendees;

      await form.save();

      // Clean up uploaded file
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error("Error cleaning up attendee file:", cleanupError);
      }

      res.status(200).json({
        success: true,
        message: "Attendee list uploaded successfully",
        data: {
          attendeeCount: form.attendeeList.length,
          attendees: form.attendeeList,
        },
      });
    } catch (error) {
      console.error("Error uploading attendee list:", error);

      // Clean up uploaded file if error occurs
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error("Error cleaning up file:", cleanupError);
        }
      }

      res.status(500).json({
        success: false,
        message: "Failed to upload attendee list",
        error: error.message,
      });
    }
  },
];

// GET /api/forms/:id/attendees - Get attendee list for a form
const getAttendeeList = async (req, res) => {
  try {
    const { id } = req.params;

    const form = await Form.findOne({
      _id: id,
      createdBy: req.user._id,
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        attendeeCount: form.attendeeList.length,
        attendees: form.attendeeList,
      },
    });
  } catch (error) {
    console.error("Error fetching attendee list:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch attendee list",
      error: error.message,
    });
  }
};

/**
 * GET /api/forms/my-evaluations
 * Returns all published forms the current user is assigned to and can currently answer.
 * This is used for listing available evaluations for the participant.
 */
const getMyEvaluations = async (req, res) => {
  try {
    const userEmail = req.user.email ? req.user.email.toLowerCase().trim() : "";

    if (!userEmail) {
      return res.status(400).json({
        success: false,
        message: "User email not found",
      });
    }

    const forms = await Form.find({
      status: "published",
      "attendeeList.email": userEmail,
    })
      .populate("createdBy", "name email")
      .select(
        "title description shareableLink eventStartDate eventEndDate attendeeList createdAt"
      )
      .sort({ createdAt: -1 });

    const now = new Date();
    const availableForms = forms.filter((form) => {
      const startDate = form.eventStartDate
        ? new Date(form.eventStartDate)
        : null;
      const endDate = form.eventEndDate ? new Date(form.eventEndDate) : null;

      if (startDate && now < startDate) {
        return false;
      }

      if (endDate && now > endDate) {
        return false;
      }

      return true;
    });

    res.status(200).json({
      success: true,
      data: {
        forms: availableForms,
        count: availableForms.length,
      },
    });
  } catch (error) {
    console.error("Error fetching my evaluations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch your evaluations",
      error: error.message,
    });
  }
};

/**
 * GET /api/forms/completion-stats
 * Returns participant evaluation completion stats for badge progression.
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     completedCount: number
 *   }
 * }
 *
 * Logic:
 * - Count distinct published forms where:
 *   - current user's email is in attendeeList
 *   - AND attendeeList.hasResponded is true for that email
 */
const getCompletionStats = async (req, res) => {
  try {
    const userEmail = req.user.email ? req.user.email.toLowerCase().trim() : "";

    if (!userEmail) {
      return res.status(400).json({
        success: false,
        message: "User email not found",
      });
    }

    const forms = await Form.find({
      status: "published",
      "attendeeList.email": userEmail,
    }).select("attendeeList");

    let completedCount = 0;

    forms.forEach((form) => {
      const attendee = (form.attendeeList || []).find(
        (a) =>
          a.email &&
          a.email.toLowerCase().trim() === userEmail &&
          a.hasResponded
      );
      if (attendee) {
        completedCount += 1;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        completedCount,
      },
    });
  } catch (error) {
    console.error("Error computing completion stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to compute completion stats",
      error: error.message,
    });
  }
};

module.exports = {
  getAllForms,
  getFormById,
  createBlankForm,
  updateDraftForm,
  uploadForm,
  extractFormByFile,
  extractFormByUrl,
  uploadFormByUrl,
  publishForm,
  deleteForm,
  submitFormResponse,
  getFormResponses,
  getMyEvaluations,
  getCompletionStats,
  uploadAttendeeList,
  getAttendeeList,
};
