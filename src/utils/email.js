const nodemailer = require("nodemailer");
const { generateRatingEmailHtml } = require("./ratingEmailTemplate.js");

/**
 * Validates email environment variables
 */
const validateEmailConfig = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error(
      "❌ [EMAIL-CONFIG] Critical error: EMAIL_USER or EMAIL_PASS environment variables are missing.",
    );
    return false;
  }
  return true;
};

// nodemailer v7+ uses default export
const createTransport =
  nodemailer.createTransport || nodemailer.default?.createTransport;

if (!createTransport) {
  throw new Error(
    "nodemailer is not properly installed. Please run: npm install nodemailer",
  );
}

/**
 * Shared transporter for the entire application
 */
const transporter = createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    // This setting is often needed for cloud environments like Render
    rejectUnauthorized: false,
  },
});

const sendEmail = async (options) => {
  if (!validateEmailConfig()) {
    throw new Error("Email configuration missing in environment variables");
  }

  let htmlContent = options.html || "";
  let subject = options.subject;
  let textContent = options.text;

  // Auto-detect rating email and generate HTML if rating data provided
  if (options.ratingData) {
    htmlContent = generateRatingEmailHtml({
      participantName: options.ratingData.participantName,
      questionText: options.ratingData.questionText,
      ratingScore: options.ratingData.ratingScore,
      maxScore: options.ratingData.maxScore || 10,
      adminName: options.ratingData.adminName || "Admin/Team",
    });
    subject =
      options.ratingData.subject ||
      `${options.ratingData.participantName} - Rating Response: ${options.ratingData.questionText} = ${options.ratingData.ratingScore}`;
  }

  const mailOptions = {
    from: `"Event Evaluation System" <${process.env.EMAIL_USER}>`,
    to: options.to || options.email,
    subject: subject,
    html: htmlContent,
    text: textContent || options.message,
    attachments: options.attachments || [],
  };

  const info = await transporter.sendMail(mailOptions);

  console.log("Email sent successfully: %s", info.messageId);
  return info;
};

module.exports = {
  sendEmail,
  transporter,
  validateEmailConfig,
};
