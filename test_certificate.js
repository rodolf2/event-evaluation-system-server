// Simple test script for certificate generation
// Run this after setting up the database and environment variables

const mongoose = require('mongoose');
require('dotenv').config();

// Test data (you'll need to replace these with actual IDs from your database)
const testUserId = 'YOUR_TEST_USER_ID'; // Replace with actual user ID
const testEventId = 'YOUR_TEST_EVENT_ID'; // Replace with actual event ID

async function testCertificateGeneration() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/event-evaluation-system');
    console.log('Connected to database');

    // Test certificate generation API
    const response = await fetch('http://localhost:5000/api/certificates/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        userId: testUserId,
        eventId: testEventId,
        certificateType: 'participation',
        customMessage: 'Test certificate generation',
        sendEmail: false // Set to false for testing
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Certificate generated successfully!');
      console.log('Certificate ID:', result.data.certificateId);
      console.log('Download URL:', result.data.downloadUrl);

      // Test certificate retrieval
      const certResponse = await fetch(`http://localhost:5000/api/certificates/${result.data.certificateId}`);
      const certResult = await certResponse.json();

      if (certResult.success) {
        console.log('✅ Certificate retrieved successfully!');
        console.log('Certificate details:', {
          type: certResult.data.certificateType,
          issuedDate: certResult.data.issuedDate,
          emailSent: certResult.data.isEmailSent
        });
      } else {
        console.log('❌ Failed to retrieve certificate:', certResult.message);
      }

    } else {
      console.log('❌ Certificate generation failed:', result.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Instructions for manual testing
console.log(`
📋 CERTIFICATE GENERATOR TESTING INSTRUCTIONS:

1. Set up your .env file with:
   - MONGODB_URI=mongodb://localhost:27017/event-evaluation-system
   - EMAIL_USER=your-email@gmail.com (optional for testing)
   - EMAIL_PASS=your-app-password (optional for testing)

2. Update the test data in this file:
   - Replace YOUR_TEST_USER_ID with an actual user ID from your database
   - Replace YOUR_TEST_EVENT_ID with an actual event ID from your database

3. Run the test:
   node test_certificate.js

4. Manual API Testing:
   - Generate: POST http://localhost:5000/api/certificates/generate
   - Get: GET http://localhost:5000/api/certificates/CERTIFICATE_ID
   - Download: GET http://localhost:5000/api/certificates/download/CERTIFICATE_ID
   - Bulk: POST http://localhost:5000/api/certificates/generate-bulk

5. Check the generated PDF in: src/uploads/certificates/

For production use:
- Set up Gmail App Password for email functionality
- Configure proper environment variables
- Test with real user and event data
`);

// Uncomment the line below to run the test
// testCertificateGeneration();

module.exports = { testCertificateGeneration };