const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';

/**
 * Test Form Extraction - Test both file and URL extraction endpoints
 */
async function testFormExtraction() {
  console.log('📄 Testing Form Extraction...\n');

  // First, let's check if we can make a simple unauthenticated request to extract-by-file
  console.log('1️⃣ Testing file extraction endpoint (unauthenticated)...');

  try {
    // Create a simple test file
    const testFilePath = path.join(__dirname, 'test_form.txt');
    const testContent = `Test Form Content

1. How would you rate the event?
   a) Excellent
   b) Good
   c) Average
   d) Poor

2. What did you like most about the event?

3. Would you recommend this event to others?
   Yes
   No
   Maybe`;

    fs.writeFileSync(testFilePath, testContent);

    // Test file extraction
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testFilePath));

    try {
      const response = await axios.post(`${BASE_URL}/api/forms/extract-by-file`, formData, {
        headers: formData.getHeaders(),
      });

      console.log('✅ File extraction successful');
      console.log('Extracted title:', response.data.data.title);
      console.log('Number of questions:', response.data.data.questions.length);
      console.log('Questions:', response.data.data.questions.map(q => q.title));

    } catch (error) {
      console.log('❌ File extraction failed:', error.response?.data?.message || error.message);
    }

    // Clean up
    fs.unlinkSync(testFilePath);

  } catch (error) {
    console.error('❌ File extraction test failed:', error.message);
  }

  // Test URL extraction
  console.log('\n2️⃣ Testing URL extraction endpoint (unauthenticated)...');

  try {
    const testUrl = 'https://docs.google.com/forms/d/1abc123/viewform'; // Invalid test URL

    try {
      const response = await axios.post(`${BASE_URL}/api/forms/extract-by-url`, { url: testUrl });

      console.log('✅ URL extraction successful');
      console.log('Extracted title:', response.data.data.title);
      console.log('Number of questions:', response.data.data.questions.length);

    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ URL extraction correctly rejected invalid URL');
        console.log('Error message:', error.response.data.message);
      } else {
        console.log('❌ URL extraction failed:', error.response?.data?.message || error.message);
      }
    }

  } catch (error) {
    console.error('❌ URL extraction test failed:', error.message);
  }

  console.log('\n🧪 Form extraction tests completed');
}

// Run the test
if (require.main === module) {
  testFormExtraction();
}

module.exports = { testFormExtraction };