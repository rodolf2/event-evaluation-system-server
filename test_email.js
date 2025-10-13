// Email testing script for certificate generator
// Run this to test if email functionality is working

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Event = require('./src/models/Event');

async function testEmailFunctionality() {
  console.log('🧪 Testing Certificate Email Functionality...\n');

  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/event-evaluation-system');
    console.log('✅ Connected to database');

    // Check if test user exists, create if not
    let testUser = await User.findOne({ email: 'test@example.com' });
    if (!testUser) {
      testUser = new User({
        name: 'Test User',
        email: 'test@example.com',
        googleId: 'test-google-id-123'
      });
      await testUser.save();
      console.log('✅ Created test user');
    }

    // Check if test event exists, create if not
    let testEvent = await Event.findOne({ name: 'Test Event' });
    if (!testEvent) {
      testEvent = new Event({
        name: 'Test Event for Email Testing',
        date: new Date()
      });
      await testEvent.save();
      console.log('✅ Created test event');
    }

    console.log('\n📧 Testing certificate generation with email...\n');

    // Test API endpoint for certificate generation with email
    const response = await fetch('http://localhost:5000/api/certificates/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        userId: testUser._id,
        eventId: testEvent._id,
        certificateType: 'participation',
        customMessage: 'This is a test certificate for email functionality testing.',
        sendEmail: true  // Enable email sending
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Certificate generated successfully!');
      console.log('📧 Email should be sent to:', testUser.email);
      console.log('📄 Certificate ID:', result.data.certificateId);
      console.log('🔗 Download URL:', result.data.downloadUrl);

      // Check if email was marked as sent
      const Certificate = require('./src/models/Certificate');
      const certificate = await Certificate.findOne({ certificateId: result.data.certificateId });

      if (certificate && certificate.isEmailSent) {
        console.log('✅ Email was sent successfully!');
        console.log('📅 Email sent at:', certificate.emailSentDate);
      } else {
        console.log('⚠️ Certificate generated but email might not have been sent');
        console.log('   Check the server console for email-related errors');
      }

    } else {
      console.log('❌ Certificate generation failed:', result.message);

      if (result.error && result.error.includes('nodemailer')) {
        console.log('\n📧 Email configuration issue detected!');
        console.log('Please check your email settings in the .env file');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);

    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n🚫 Server is not running!');
      console.log('Please start the server first: npm run dev');
    } else if (error.message.includes('nodemailer')) {
      console.log('\n📧 Email configuration error!');
      console.log('Check your Gmail credentials in the .env file');
    }
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Manual email testing function
async function testEmailDirectly() {
  console.log('📧 Testing email sending directly...\n');

  try {
    const nodemailer = require('nodemailer');

    // Create transporter (this will fail if credentials are wrong)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Verify connection
    await transporter.verify();
    console.log('✅ Email server connection verified');
    console.log('📧 Ready to send emails from:', process.env.EMAIL_USER);

  } catch (error) {
    console.log('❌ Email configuration error:', error.message);

    if (error.message.includes('Invalid login')) {
      console.log('\n🔑 Gmail authentication failed!');
      console.log('Please check your EMAIL_USER and EMAIL_PASS in .env file');
    } else if (error.message.includes('EAUTH')) {
      console.log('\n🔐 Authentication error!');
      console.log('Make sure you are using an App Password, not your regular Gmail password');
    }
  }
}

// Instructions
console.log(`
📋 EMAIL TESTING INSTRUCTIONS:

1. Set up your .env file with Gmail credentials:
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-16-character-app-password

2. Enable Gmail App Password:
   - Go to Google Account → Security → 2-Step Verification → App passwords
   - Generate a new App Password for this application
   - Use the 16-character password (not your regular password)

3. Run the tests:
   node test_email.js

4. Check your email:
   - Look for emails from your EMAIL_USER address
   - Check spam/junk folder if not in inbox
   - Verify the PDF attachment is included

5. Troubleshooting:
   - Server must be running: npm run dev
   - Gmail 2FA must be enabled
   - Use App Password, not regular password
   - Check firewall and antivirus settings

For manual testing:
- Generate certificate: POST /api/certificates/generate (with sendEmail: true)
- Resend email: POST /api/certificates/:id/resend
- Check email status in certificate record

`);

// Run the tests
testEmailDirectly().then(() => {
  console.log('\n' + '='.repeat(50));
  return testEmailFunctionality();
}).catch(console.error);

module.exports = { testEmailFunctionality, testEmailDirectly };