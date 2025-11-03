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
    console.log('Inside /csv route handler');
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      // Parse the CSV file to extract student data
      const filePath = req.file.path;
      const students = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          students.push(data);
        })
        .on('end', () => {
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
        })
        .on('error', (error) => {
          console.error('CSV parsing error:', error);
          res.status(500).json({
            success: false,
            message: 'Failed to parse CSV file',
            error: error.message
          });
        });

    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload file',
        error: error.message
      });
    }
  });
});

module.exports = router;