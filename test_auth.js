const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

/**
 * Test Authentication to get JWT token
 */
async function testAuth() {
  console.log('🔐 Testing Authentication...\n');

  try {
    // Test 1: Get Google OAuth URL
    console.log('1️⃣ Getting Google OAuth URL...');
    const authResponse = await axios.get(`${BASE_URL}/api/auth/google`, {
      maxRedirects: 0,
      validateStatus: function (status) {
        return status >= 200 && status < 400; // Accept redirects
      }
    });

    if (authResponse.status === 302) {
      console.log('✅ OAuth redirect URL:', authResponse.headers.location);
      console.log('\n🔗 Please visit this URL in your browser to authenticate with Google');
      console.log('After authentication, you should be redirected back and can get the JWT token');
    } else {
      console.log('Response:', authResponse.data);
    }

    // Test 2: Check if we can access a protected route (will fail without token)
    console.log('\n2️⃣ Testing protected route access...');
    try {
      await axios.get(`${BASE_URL}/api/auth/profile`);
      console.log('❌ Unexpected success - should have been unauthorized');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Protected route correctly requires authentication');
      } else {
        console.log('Unexpected error:', error.response?.data || error.message);
      }
    }

  } catch (error) {
    console.error('❌ Auth test failed:', error.response?.data || error.message);
  }
}

// Run auth test
if (require.main === module) {
  testAuth();
}

module.exports = { testAuth };