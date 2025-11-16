const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const { requireAuth } = require('../../middlewares/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../../uploads/csv');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'csv-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter to only allow CSV files
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Robust CSV parsing function to handle edge cases
function parseCSVText(csvText) {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim() !== "");
  
  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  // Parse headers with trimming
  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().toLowerCase());

  // Check for required headers
  const requiredHeaders = ["name", "email"];
  const missingHeaders = requiredHeaders.filter(
    (required) => !headers.includes(required)
  );
  
  if (missingHeaders.length > 0) {
    throw new Error(
      `Missing required column(s): ${missingHeaders.join(
        ", "
      )}. Expected columns: name, email.`
    );
  }

  const emailIndex = headers.indexOf("email");
  const nameIndex = headers.indexOf("name");
  const seenEmails = new Set();
  const students = [];

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;

    // Handle quoted fields and commas in CSV more robustly
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < raw.length; j++) {
      const char = raw[j];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim()); // Add the last value

    if (values.length < headers.length) {
      throw new Error(
        `Row ${i + 1}: expected ${headers.length} columns but found ${values.length}.`
      );
    }

    const name = values[nameIndex] || "";
    const email = (values[emailIndex] || "").toLowerCase().trim();

    if (!name || !email) {
      throw new Error(`Row ${i + 1}: missing required name or email.`);
    }

    if (!emailRegex.test(email)) {
      throw new Error(`Row ${i + 1}: invalid email format (${email}).`);
    }

    const normalizedEmail = email.toLowerCase();
    if (seenEmails.has(normalizedEmail)) {
      throw new Error(`Row ${i + 1}: duplicate email (${email}).`);
    }

    seenEmails.add(normalizedEmail);

    const student = {};
    headers.forEach((header, index) => {
      // Always normalize email field for consistency
      if (header === "email") {
        student[header] = normalizedEmail;
      } else {
        student[header] = values[index] ?? "";
      }
    });

    students.push(student);
  }

  if (students.length === 0) {
    throw new Error("No valid recipients found in CSV.");
  }

  return students;
}

// Upload CSV file
router.post('/csv', requireAuth, (req, res) => {
  upload.single('file')(req, res, function (err) {
    if (err) {
      console.error('Multer error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload file due to multer error',
        error: err.message
      });
    }
    
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      // Read the CSV file and parse it using our robust parser
      const filePath = req.file.path;
      const csvText = fs.readFileSync(filePath, 'utf8');
      const students = parseCSVText(csvText);
           
      console.log(`Parsed ${students.length} students from CSV`);
           
      // Return the file URL along with student data
      const fileUrl = `${req.protocol}://${req.get('host')}/uploads/csv/${req.file.filename}`;

      res.json({
        success: true,
        message: 'File uploaded and parsed successfully',
        url: fileUrl,
        filename: req.file.originalname,
        size: req.file.size,
        students: students
      });

    } catch (error) {
      console.error('CSV parsing error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to parse CSV file',
        error: error.message
      });
    }
  });
});

module.exports = router;