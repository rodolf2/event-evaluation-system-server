// Simple API test for email functionality
// Run this after setting up your .env file with Gmail credentials

const testUserId = "68ed2e255af833375bbe0174"; // Replace with actual user ID
const testEventId = "68ed2e255af833375bbe017f"; // Replace with actual event ID

async function testEmailAPI() {
  console.log('🚀 Testing Certificate Email API...\n');

  try {
    // Test 1: Generate certificate with email
    console.log('📧 Test 1: Generating certificate with email...');

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
        customMessage: 'Testing email functionality - Please ignore this test certificate.',
        sendEmail: true
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Certificate generated successfully');
      console.log('📧 Email should be sent to the user\'s email address');
      console.log('🔗 Certificate ID:', result.data.certificateId);

      // Test 2: Check certificate details
      console.log('\n📋 Test 2: Checking certificate details...');
      const certResponse = await fetch(`http://localhost:5000/api/certificates/${result.data.certificateId}`);
      const certResult = await certResponse.json();

      if (certResult.success) {
        console.log('✅ Certificate details retrieved');
        console.log('   Email Sent:', certResult.data.isEmailSent ? 'Yes' : 'No');
        if (certResult.data.emailSentDate) {
          console.log('   Sent At:', certResult.data.emailSentDate);
        }
      }

      // Test 3: Resend email (if needed)
      console.log('\n📧 Test 3: Testing email resend...');
      const resendResponse = await fetch(`http://localhost:5000/api/certificates/${result.data.certificateId}/resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const resendResult = await resendResponse.json();

      if (resendResult.success) {
        console.log('✅ Email resent successfully');
      } else {
        console.log('❌ Email resend failed:', resendResult.message);
      }

    } else {
      console.log('❌ Certificate generation failed:', result.message);
    }

  } catch (error) {
    console.error('❌ API test failed:', error.message);

    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n🚫 Make sure the server is running: npm run dev');
    }
  }
}

// Show API testing examples
console.log(`
📡 API TESTING EXAMPLES:

1. Generate certificate with email:
curl -X POST http://localhost:5000/api/certificates/generate \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json" \\
  -d '{
    "userId": "${testUserId}",
    "eventId": "${testEventId}",
    "certificateType": "participation",
    "sendEmail": true
  }'

2. Check certificate status:
curl http://localhost:5000/api/certificates/CERT-1234567890-123

3. Resend certificate email:
curl -X POST http://localhost:5000/api/certificates/CERT-1234567890-123/resend

4. Download certificate PDF:
curl http://localhost:5000/api/certificates/download/CERT-1234567890-123 \\
  -o certificate.pdf

5. Get user certificates:
curl http://localhost:5000/api/certificates/user/${testUserId}

📧 EMAIL SETUP CHECKLIST:

✅ Gmail 2-Factor Authentication enabled
✅ App Password generated (16 characters)
✅ .env file updated with:
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
✅ Server running: npm run dev
✅ Less secure apps enabled OR App Password used

🔍 TROUBLESHOOTING:

- Check server console for email errors
- Verify App Password is correct (not regular password)
- Check spam folder in email
- Ensure Gmail account has 2FA enabled
- Try sending email to yourself first

`);

// Uncomment to run the test
// testEmailAPI();

module.exports = { testEmailAPI };