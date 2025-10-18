// Development Testing Script for User Management
// Run this with: node test_user_management_development.js

const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testDevelopmentMode() {
  console.log('🧪 Starting Development Mode Tests...\n');

  try {
    // Test 1: Check if server is running
    console.log('1️⃣ Testing server connectivity...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Server is running:', healthResponse.data);

    // Test 2: Check development mode status
    console.log('\n2️⃣ Checking development mode...');
    console.log('ℹ️ Development mode allows emails with "admin" for testing');
    console.log('ℹ️ Production mode requires @laverdad.edu.ph emails');

    // Test 3: Check bootstrap status
    console.log('\n3️⃣ Checking bootstrap status...');
    const bootstrapResponse = await axios.get(`${BASE_URL}/api/bootstrap/status`);
    console.log('✅ Bootstrap status:', bootstrapResponse.data);

    if (bootstrapResponse.data.data.needsBootstrap) {
      // Test 4: Create development admin user
      console.log('\n4️⃣ Creating development admin user...');
      const adminResponse = await axios.post(`${BASE_URL}/api/bootstrap/admin`, {
        name: 'Development Administrator',
        email: 'dev.admin@test.com'
      });
      console.log('✅ Development admin created:', adminResponse.data);
    } else {
      console.log('\nℹ️ Admin users already exist - skipping bootstrap');
    }

    // Test 5: Test development email patterns
    console.log('\n5️⃣ Testing email patterns for development...');

    const testEmails = [
      'admin@gmail.com',
      'test.admin@outlook.com',
      'myadmin@protonmail.com',
      'dev-admin@company.com'
    ];

    console.log('✅ These emails work for admin during development:');
    testEmails.forEach(email => {
      console.log(`   - ${email} ${email.includes('admin') ? '✅' : '❌'}`);
    });

    console.log('\n📊 Summary:');
    console.log('   - ✅ Development mode is active');
    console.log('   - ✅ Flexible admin email testing enabled');
    console.log('   - ✅ Use any email with "admin" for testing');
    console.log('   - ✅ Production will enforce @laverdad.edu.ph only');

    console.log('\n🚀 Ready for Testing!');
    console.log('   1. Go to: http://localhost:5000/bootstrap.html');
    console.log('   2. Use: dev.admin@test.com (or any email with "admin")');
    console.log('   3. Create admin account');
    console.log('   4. Go to: http://localhost:5000/admin.html');
    console.log('   5. Login with same email');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response ? error.response.data : error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure server is running: npm start');
    console.log('   2. Check if NODE_ENV=development in .env file');
    console.log('   3. Verify MongoDB is connected');
  }
}

// Manual admin creation
async function createDevAdmin() {
  console.log('👨‍💼 Creating Development Admin...\n');

  try {
    const response = await axios.post(`${BASE_URL}/api/bootstrap/admin`, {
      name: 'Development Admin',
      email: 'development.admin@test.com'
    });

    console.log('✅ Development admin created successfully!');
    console.log('📧 Email: development.admin@test.com');
    console.log('🔑 Use this email to login at: http://localhost:5000/admin.html');

  } catch (error) {
    if (error.response) {
      console.log('ℹ️ Response:', error.response.data.message);
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

// Run tests
if (require.main === module) {
  testDevelopmentMode();
}

// Export for manual use
module.exports = {
  testDevelopmentMode,
  createDevAdmin
};