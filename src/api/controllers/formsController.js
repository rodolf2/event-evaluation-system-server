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
      cb(new Error("Invalid file type. Allowed types: PDF, DOC, DOCX, CSV, XLS, XLSX, TXT"), false);
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
      cb(new Error("Invalid file type. Only CSV and Excel files are allowed for attendee lists."), false);
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

    const form = await Form.findOne({
      _id: id,
      createdBy: req.user._id,
    }).populate("createdBy", "name email");

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
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

// POST /api/forms/blank - Create a new blank form
const createBlankForm = async (req, res) => {
  try {
    console.log("Creating blank form - Request body:", req.body);
    console.log("User from auth:", req.user);

    const { title, description, questions, uploadedFiles, uploadedLinks, eventStartDate, eventEndDate } = req.body;

    if (!req.user || !req.user._id) {
      console.log("User not authenticated");
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const formData = {
      title: title || "Untitled Form",
      description: description || "Form Description",
      questions: questions || [],
      status: "draft",
      createdBy: req.user._id,
      uploadedFiles: uploadedFiles || [],
      uploadedLinks: uploadedLinks || [],
      eventStartDate: eventStartDate ? new Date(eventStartDate) : null,
      eventEndDate: eventEndDate ? new Date(eventEndDate) : null,
    };

    console.log("Form data to save:", formData);

    const form = new Form(formData);
    const savedForm = await form.save();

    console.log("Form created successfully:", savedForm._id);

    // Process uploaded CSV files to extract attendee data
    if (uploadedLinks && uploadedLinks.length > 0) {
      try {
        for (const link of uploadedLinks) {
          if (link.url && link.url.includes('.csv')) {
            console.log("Processing CSV file for attendees:", link.url);

            // Extract file path from URL
            const filePath = link.url.replace('http://localhost:5000', '');
            const fullPath = require('path').join(__dirname, '../..', filePath);

            const parsedAttendees = await formsService.parseAttendeeFile(fullPath);
            console.log(`Parsed ${parsedAttendees.length} attendees from CSV`);

            if (parsedAttendees.length > 0) {
              // Convert parsed attendees to attendeeList format with normalized emails
              const attendeeList = parsedAttendees.map(attendee => ({
                userId: null, // Will be populated when users respond
                name: attendee.name || '',
                email: attendee.email ? attendee.email.toLowerCase().trim() : '',
                hasResponded: false,
                uploadedAt: new Date(),
              }));

              // Validate attendee data
              const validAttendees = attendeeList.filter(attendee =>
                attendee.name.trim() !== '' && attendee.email.includes('@')
              );

              if (validAttendees.length > 0) {
                // Update form with attendee list
                savedForm.attendeeList = validAttendees;
                await savedForm.save();
                console.log(`Updated form with ${validAttendees.length} valid attendees`);
                break; // Only process the first CSV file
              } else {
                console.warn("No valid attendees found in CSV after filtering");
              }
            }
          }
        }
      } catch (csvError) {
        console.error("Error processing CSV file:", csvError);
        // Log the error but don't fail the form creation
        console.log("CSV processing failed, continuing with form creation without attendees");
      }
    }

    res.status(201).json({
      success: true,
      message: "Form created successfully",
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
        message: "This Google Form has already been imported. You can find it in your recent evaluations.",
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
        message: "This Google Form has already been imported. You can edit the existing form instead.",
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

// PATCH /api/forms/:id/publish - Publish a form and generate shareable link
const publishForm = async (req, res) => {
  try {
    const { id } = req.params;
    const { questions } = req.body;

    console.log("Publishing form - ID:", id);
    console.log("Questions to publish:", questions);
    console.log("User from auth:", req.user);

    const form = await Form.findOne({
      _id: id,
      createdBy: req.user._id,
    });

    if (!form) {
      console.log("Form not found for ID:", id);
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    console.log("Found form:", form._id);

    // Validate event dates if provided
    if (form.eventStartDate && form.eventEndDate) {
      const now = new Date();
      const startDate = new Date(form.eventStartDate);
      const endDate = new Date(form.eventEndDate);

      if (startDate >= endDate) {
        return res.status(400).json({
          success: false,
          message: "Event start date must be before end date",
        });
      }

      // Optional: Check if publishing within the event period
      // if (now < startDate || now > endDate) {
      //   return res.status(400).json({
      //     success: false,
      //     message: "Cannot publish form outside of event dates",
      //   });
      // }
    }

    // Update form with final questions and publish
    form.questions = questions;
    form.status = "published";
    form.publishedAt = new Date();

    // Generate shareable link
    const shareableLink = `${process.env.CLIENT_URL || "http://localhost:3000"}/form/${form._id}`;

    form.shareableLink = shareableLink;

    const savedForm = await form.save();
    console.log("Form published successfully:", savedForm._id);

    res.status(200).json({
      success: true,
      message: "Form published successfully",
      data: {
        form: savedForm,
        shareableLink,
      },
    });
  } catch (error) {
    console.error("Error publishing form:", error);
    console.error("Error stack:", error.stack);
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

    const form = await Form.findOneAndDelete({
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
      message: "Form deleted successfully",
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
      const startDate = form.eventStartDate ? new Date(form.eventStartDate) : null;
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

    await form.save();

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
      const parsedAttendees = await formsService.parseAttendeeFile(req.file.path);

      const processedAttendees = await Promise.all(
        parsedAttendees.map(async (attendee) => {
          // Normalize email for consistency
          const normalizedEmail = attendee.email ? attendee.email.toLowerCase().trim() : '';

          let user = await User.findOne({ email: normalizedEmail });

          if (!user) {
            // Create new user if not found
            user = new User({
              name: attendee.name ? attendee.name.trim() : (attendee.email ? attendee.email.split('@')[0].trim() : 'Unknown'), // Fallback name
              email: normalizedEmail,
              role: 'participant', // Default role for imported attendees
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

// GET /api/forms/my-evaluations - Get forms that the current user is assigned to
const getMyEvaluations = async (req, res) => {
  try {
    const userEmail = req.user.email ? req.user.email.toLowerCase().trim() : '';
    const userName = req.user.name ? req.user.name.trim() : '';

    console.log('getMyEvaluations - User info:', { email: userEmail, name: userName });

    // Find forms where the user is in the attendeeList using more robust matching
    const forms = await Form.find({
      status: 'published'
    })
    .populate('createdBy', 'name email')
    .select('title description shareableLink eventStartDate eventEndDate attendeeList createdAt')
    .sort({ createdAt: -1 });

    console.log(`Found ${forms.length} published forms total`);

    // Filter forms where the user is in the attendeeList and hasn't responded
    const availableForms = [];

    for (const form of forms) {
      if (!form.attendeeList || form.attendeeList.length === 0) {
        continue;
      }

      // Check if user is in attendee list
      const attendee = form.attendeeList.find(attendee => {
        const attendeeEmail = attendee.email ? attendee.email.toLowerCase().trim() : '';
        const attendeeName = attendee.name ? attendee.name.trim() : '';

        // Match by email first (primary identifier)
        if (userEmail && attendeeEmail === userEmail) {
          return true;
        }

        // Fallback to name matching if email is not available
        if (!userEmail && attendeeName && userName && attendeeName === userName) {
          return true;
        }

        return false;
      });

      if (attendee && !attendee.hasResponded) {
        // Check event date restrictions if set
        if (form.eventStartDate || form.eventEndDate) {
          const now = new Date();
          const startDate = form.eventStartDate ? new Date(form.eventStartDate) : null;
          const endDate = form.eventEndDate ? new Date(form.eventEndDate) : null;

          if (startDate && now < startDate) {
            console.log(`Form "${form.title}" not available yet - starts ${startDate}`);
            continue;
          }

          if (endDate && now > endDate) {
            console.log(`Form "${form.title}" is no longer available - ended ${endDate}`);
            continue;
          }
        }

        availableForms.push(form);
        console.log(`Added available form: "${form.title}" for user ${userEmail || userName}`);
      }
    }

    console.log(`Final available forms: ${availableForms.length}`);

    res.status(200).json({
      success: true,
      data: {
        forms: availableForms,
        count: availableForms.length,
        debug: {
          totalPublishedForms: forms.length,
          availableFormsCount: availableForms.length,
          userEmail: userEmail,
          userName: userName
        }
      },
    });
  } catch (error) {
    console.error('Error fetching my evaluations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your evaluations',
      error: error.message,
    });
  }
};

module.exports = {
  getAllForms,
  getFormById,
  createBlankForm,
  uploadForm,
  extractFormByFile,
  extractFormByUrl,
  uploadFormByUrl,
  publishForm,
  deleteForm,
  submitFormResponse,
  getFormResponses,
  getMyEvaluations,
  uploadAttendeeList,
  getAttendeeList,
};