const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const csv = require("csv-parser");
const ExcelJS = require("exceljs");
const { requireAuth } = require("../../middlewares/auth");

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../../../uploads/csv");
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "csv-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter to allow CSV and Excel files
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];
  const allowedExtensions = [".csv", ".xlsx", ".xls"];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error("Only CSV and Excel files (.csv, .xlsx, .xls) are allowed!"),
      false
    );
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Robust CSV parsing function to handle edge cases
function parseCSVText(csvText) {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim() !== "");

  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  // Parse headers with trimming
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

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
    let current = "";
    let inQuotes = false;

    for (let j = 0; j < raw.length; j++) {
      const char = raw[j];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
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

// Parse Excel file and extract students
async function parseExcelFile(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("No worksheet found in Excel file");
  }

  const students = [];
  let headers = [];
  let nameIndex = -1;
  let emailIndex = -1;

  worksheet.eachRow((row, rowNumber) => {
    const values = row.values.slice(1); // ExcelJS uses 1-based indexing

    if (rowNumber === 1) {
      // First row is headers
      headers = values.map((v) => (v ? String(v).toLowerCase().trim() : ""));
      nameIndex = headers.findIndex(
        (h) =>
          h.includes("name") || h.includes("full name") || h.includes("student")
      );
      emailIndex = headers.findIndex(
        (h) => h.includes("email") || h.includes("e-mail")
      );

      if (nameIndex === -1 || emailIndex === -1) {
        throw new Error(
          "Excel file must have 'name' and 'email' columns. Found columns: " +
            headers.join(", ")
        );
      }
    } else {
      // Data rows
      const name = values[nameIndex] ? String(values[nameIndex]).trim() : "";
      const email = values[emailIndex]
        ? String(values[emailIndex]).toLowerCase().trim()
        : "";

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (name && email && emailRegex.test(email)) {
        const student = { name, email };
        // Add any other columns
        headers.forEach((header, index) => {
          if (index !== nameIndex && index !== emailIndex && values[index]) {
            student[header] = String(values[index]).trim();
          }
        });
        students.push(student);
      }
    }
  });

  if (students.length === 0) {
    throw new Error(
      "No valid students found in Excel file. Ensure 'name' and 'email' columns have valid data."
    );
  }

  return students;
}

// Upload CSV or Excel file
router.post("/csv", requireAuth, (req, res) => {
  upload.single("file")(req, res, async function (err) {
    if (err) {
      console.error("Multer error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to upload file due to multer error",
        error: err.message,
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      const filePath = req.file.path;
      const ext = path.extname(req.file.originalname).toLowerCase();
      let students;

      // Parse based on file type
      if (ext === ".xlsx" || ext === ".xls") {
        console.log(`📊 Parsing Excel file: ${req.file.originalname}`);
        students = await parseExcelFile(filePath);
        console.log(`📊 Parsed ${students.length} students from Excel`);
      } else {
        console.log(`📋 Parsing CSV file: ${req.file.originalname}`);
        const csvText = fs.readFileSync(filePath, "utf8");
        students = parseCSVText(csvText);
        console.log(`📋 Parsed ${students.length} students from CSV`);
      }

      // Return the file URL along with student data
      const fileUrl = `${req.protocol}://${req.get("host")}/uploads/csv/${req.file.filename}`;

      res.json({
        success: true,
        message: "File uploaded and parsed successfully",
        url: fileUrl,
        filename: req.file.originalname,
        size: req.file.size,
        students: students,
      });
    } catch (error) {
      console.error("File parsing error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to parse file",
        error: error.message,
      });
    }
  });
});

// POST /api/upload/csv-from-url - Fetch and parse CSV from external URL (proxy to avoid CORS)
router.post("/csv-from-url", requireAuth, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "URL is required",
      });
    }

    console.log(`📥 [CSV Proxy] Fetching CSV from: ${url}`);

    // Convert Google Sheets URL to export format if needed
    let fetchUrl = url;
    if (url.includes("docs.google.com/spreadsheets")) {
      fetchUrl = url
        .replace("/edit?usp=sharing", "/export?format=csv")
        .replace("/edit", "/export?format=csv");

      // If URL doesn't have export format, add it
      if (!fetchUrl.includes("/export")) {
        // Extract the spreadsheet ID and construct export URL
        const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match) {
          fetchUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
        }
      }
      console.log(`📥 [CSV Proxy] Converted to export URL: ${fetchUrl}`);
    }

    // Fetch the CSV content
    const axios = require("axios");
    const response = await axios.get(fetchUrl, {
      timeout: 30000,
      responseType: "text",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const csvText = response.data;

    if (!csvText || csvText.length === 0) {
      throw new Error("Empty response from URL");
    }

    // Check if we got HTML instead of CSV (indicates the sheet is not public)
    if (csvText.includes("<!DOCTYPE html>") || csvText.includes("<html")) {
      throw new Error(
        'The spreadsheet is not publicly accessible. Please set sharing to "Anyone with the link can view".'
      );
    }

    console.log(`📥 [CSV Proxy] Fetched ${csvText.length} characters`);

    // Parse the CSV
    const students = parseCSVText(csvText);

    console.log(`📥 [CSV Proxy] Parsed ${students.length} students`);

    // Extract filename from URL
    let filename = "external-csv.csv";
    try {
      const urlObj = new URL(url);
      filename = urlObj.pathname.split("/").pop() || "external-csv.csv";
      if (!filename.endsWith(".csv")) {
        filename = "google-sheet.csv";
      }
    } catch {
      filename = "external-csv.csv";
    }

    res.json({
      success: true,
      message: "CSV fetched and parsed successfully",
      url: url,
      filename: filename,
      students: students,
    });
  } catch (error) {
    console.error("📥 [CSV Proxy] Error:", error.message);

    let errorMessage = error.message;
    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      errorMessage =
        "Could not connect to the URL. Please check if the URL is correct and accessible.";
    } else if (error.response && error.response.status === 401) {
      errorMessage =
        'Authentication required. The spreadsheet is not publicly accessible. Please go to Share settings and set it to "Anyone with the link can view".';
    } else if (error.response && error.response.status === 403) {
      errorMessage =
        'Access denied. The spreadsheet may be restricted to your organization. Please set sharing to "Anyone with the link can view".';
    } else if (error.response && error.response.status === 404) {
      errorMessage =
        "Spreadsheet not found. Please check if the URL is correct.";
    }

    res.status(500).json({
      success: false,
      message: "Failed to fetch CSV from URL",
      error: errorMessage,
    });
  }
});

module.exports = router;
