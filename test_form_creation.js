const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

/**
 * Test Form Creation - This will test creating a form without authentication
 * to confirm the issue is with user authentication
 */
async function testFormCreation() {
  console.log('📝 Testing Form Creation...\n');

  try {
    // Test 1: Try to create a form without authentication (should fail)
    console.log('1️⃣ Testing form creation without auth...');
    const formData = {
      title: "Test Form",
      description: "Test Description",
      questions: [],
      createdBy: null,
      uploadedFiles: [],
      uploadedLinks: []
    };

    try {
      const response = await axios.post(`${BASE_URL}/api/forms/blank`, formData);
      console.log('❌ Unexpected success - should have failed without auth');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Correctly blocked unauthenticated form creation');
        console.log('Error message:', error.response.data.message);
      } else {
        console.log('Unexpected error:', error.response?.data || error.message);
      }
    }

    // Test 2: Try to access forms list without auth (should fail)
    console.log('\n2️⃣ Testing forms list access without auth...');
    try {
      const response = await axios.get(`${BASE_URL}/api/forms`);
      console.log('❌ Unexpected success - should have failed without auth');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Correctly blocked unauthenticated forms access');
        console.log('Error message:', error.response.data.message);
      } else {
        console.log('Unexpected error:', error.response?.data || error.message);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
if (require.main === module) {
  testFormCreation();
}

module.exports = { testFormCreation };