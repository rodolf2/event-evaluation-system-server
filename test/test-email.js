require("dotenv").config();
const { sendEmail } = require("./src/utils/email");

async function testEmail() {
  try {
    console.log("Testing email functionality...");
    console.log("EMAIL_SERVICE:", process.env.EMAIL_SERVICE || "gmail");
    console.log("EMAIL_USER:", process.env.EMAIL_USER ? "Set" : "Not set");
    console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "Set" : "Not set");
    console.log(
      "SENDGRID_API_KEY:",
      process.env.SENDGRID_API_KEY ? "Set" : "Not set",
    );

    const result = await sendEmail({
      to: process.env.EMAIL_USER, // Send to yourself for testing
      subject: "Test Email from Event Evaluation System",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Test Email</h1>
          <p>This is a test email to verify that the email functionality is working correctly.</p>
          <p><strong>Service:</strong> ${process.env.EMAIL_SERVICE || "gmail"}</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        </div>
      `,
    });

    console.log("✅ Test email sent successfully!");
    console.log("Message ID:", result.messageId);
  } catch (error) {
    console.error("❌ Test email failed:", error.message);
    console.error("Full error:", error);
  }
}

testEmail();
