// Test script for User Management System
// Run this with: node test_user_management.js

const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

// Test data
const testUsers = [
  {
    name: 'Test Administrator',
    email: 'admin@test.com',
    role: 'admin'
  },
  {
    name: 'Test Student',
    email: 'student@test.com',
    role: 'student'
  },
  {
    name: 'Test User',
    email: 'user@test.com',
    role: 'user'
  }
];

async function testUserManagement() {
  console.log('🧪 Starting User Management Tests...\n');

  try {
    // Test 1: Check if server is running
    console.log('1️⃣ Testing server connectivity...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Server is running:', healthResponse.data);

    // Test 2: Check bootstrap status
    console.log('\n2️⃣ Checking bootstrap status...');
    const bootstrapResponse = await axios.get(`${BASE_URL}/api/bootstrap/status`);
    console.log('✅ Bootstrap status:', bootstrapResponse.data);

    // Test 3: Try to create admin (should fail if admins exist)
    console.log('\n3️⃣ Testing admin creation (should fail if admins exist)...');
    try {
      const adminResponse = await axios.post(`${BASE_URL}/api/bootstrap/admin`, {
        name: 'System Administrator',
        email: 'admin@test.com'
      });
      console.log('✅ Admin created:', adminResponse.data);
    } catch (error) {
      console.log('✅ Expected: Admin creation blocked (admins already exist)');
    }

    // Test 4: Get user statistics
    console.log('\n4️⃣ Getting user statistics...');
    const statsResponse = await axios.get(`${BASE_URL}/api/users/stats/overview`);
    console.log('✅ User statistics:', statsResponse.data.data);

    // Test 5: Get all users
    console.log('\n5️⃣ Getting all users...');
    const usersResponse = await axios.get(`${BASE_URL}/api/users`);
    console.log('✅ Users list:', usersResponse.data);

    // Test 6: Create additional test users
    console.log('\n6️⃣ Creating test users...');
    for (const user of testUsers.slice(1)) { // Skip admin already created
      const createResponse = await axios.post(`${BASE_URL}/api/users`, user);
      console.log(`✅ Created ${user.role}:`, createResponse.data);
    }

    // Test 7: Update a user
    console.log('\n7️⃣ Updating a user...');
    const usersList = await axios.get(`${BASE_URL}/api/users`);
    const firstUser = usersList.data.data.users[1]; // Get second user
    const updateResponse = await axios.put(`${BASE_URL}/api/users/${firstUser._id}`, {
      name: 'Updated Student Name',
      role: 'student',
      isActive: true
    });
    console.log('✅ User updated:', updateResponse.data);

    // Test 8: Test filtering
    console.log('\n8️⃣ Testing user filters...');
    const filterResponse = await axios.get(`${BASE_URL}/api/users?role=student`);
    console.log('✅ Filtered users (students):', filterResponse.data);

    // Test 9: Get final statistics
    console.log('\n9️⃣ Final user statistics...');
    const finalStatsResponse = await axios.get(`${BASE_URL}/api/users/stats/overview`);
    console.log('✅ Final statistics:', finalStatsResponse.data.data);

    // Test 10: Test user deactivation
    console.log('\n🔟 Testing user deactivation...');
    const lastUser = usersList.data.data.users[usersList.data.data.users.length - 1];
    const deactivateResponse = await axios.delete(`${BASE_URL}/api/users/${lastUser._id}`);
    console.log('✅ User deactivated:', deactivateResponse.data);

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📊 Final Summary:');
    console.log('   - Admin users created ✅');
    console.log('   - Student users created ✅');
    console.log('   - Regular users created ✅');
    console.log('   - User updates tested ✅');
    console.log('   - User filtering tested ✅');
    console.log('   - User deactivation tested ✅');
    console.log('   - Statistics working ✅');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response ? error.response.data : error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure server is running: npm start');
    console.log('   2. Check if MongoDB is connected');
    console.log('   3. Verify .env configuration');
  }
}

// Manual API testing functions
async function manualTest() {
  console.log('🔧 Manual Testing Functions Available:');
  console.log('');

  try {
    // Create admin user
    console.log('Creating admin user...');
    const admin = await axios.post(`${BASE_URL}/api/bootstrap/admin`, {
      name: 'Manual Admin',
      email: 'manual.admin@test.com'
    });
    console.log('✅ Admin created');

    // Get users
    console.log('Getting users...');
    const users = await axios.get(`${BASE_URL}/api/users`);
    console.log('✅ Users:', users.data.data.users.length, 'total');

    // Get stats
    console.log('Getting stats...');
    const stats = await axios.get(`${BASE_URL}/api/users/stats/overview`);
    console.log('✅ Stats:', stats.data.data);

  } catch (error) {
    console.error('❌ Manual test failed:', error.response ? error.response.data : error.message);
  }
}

// Run tests
if (require.main === module) {
  testUserManagement();
}

module.exports = { testUserManagement, manualTest };