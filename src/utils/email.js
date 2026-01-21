const nodemailer = require("nodemailer");
const { generateRatingEmailHtml } = require("./ratingEmailTemplate.js");

/**
 * Validates email environment variables based on service
 */
const validateEmailConfig = () => {
  const emailService = process.env.EMAIL_SERVICE || "gmail";

  if (emailService === "sendgrid") {
    if (!process.env.SENDGRID_API_KEY) {
      console.error(
        "❌ [EMAIL-CONFIG] SendGrid API key missing. Set SENDGRID_API_KEY environment variable.",
      );
      return false;
    }
  } else if (emailService === "gmail") {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error(
        "❌ [EMAIL-CONFIG] Gmail credentials missing. Set EMAIL_USER and EMAIL_PASS environment variables.",
      );
      return false;
    }
  } else {
    console.error(
      `❌ [EMAIL-CONFIG] Invalid EMAIL_SERVICE: ${emailService}. Use 'gmail' or 'sendgrid'.`,
    );
    return false;
  }

  return true;
};

/**
 * Creates email transporter based on configured service
 */
const createEmailTransporter = () => {
  const emailService = (process.env.EMAIL_SERVICE || "gmail")
    .toLowerCase()
    .trim();
  console.log(
    `[EMAIL-TRANSPORTER] Creating transporter for service: ${emailService}`,
  );

  if (emailService === "sendgrid") {
    console.log(
      `[EMAIL-TRANSPORTER] SendGrid API key present: ${!!process.env.SENDGRID_API_KEY}`,
    );

    if (!process.env.SENDGRID_API_KEY) {
      console.error(
        `[EMAIL-TRANSPORTER] SendGrid API key missing! Falling back to Gmail.`,
      );
      return createGmailTransporter();
    }

    return nodemailer.createTransport({
      host: "smtp.sendgrid.net",
      port: 587,
      secure: false,
      auth: {
        user: "apikey",
        pass: process.env.SENDGRID_API_KEY,
      },
      // Add timeout and connection settings
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });
  } else {
    console.log(`[EMAIL-TRANSPORTER] Using Gmail configuration`);
    return createGmailTransporter();
  }
};

/**
 * Create Gmail transporter
 */
const createGmailTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
    // Add timeout settings
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
  });
};

/**
 * Shared transporter for the entire application
 */
const transporter = createEmailTransporter();

// Log email service configuration on startup
const configuredService = (process.env.EMAIL_SERVICE || "gmail")
  .toLowerCase()
  .trim();
console.log(
  `[EMAIL-INIT] EMAIL_SERVICE env var: "${process.env.EMAIL_SERVICE || "not set"}"`,
);
console.log(`[EMAIL-INIT] Resolved service: ${configuredService}`);
console.log(
  `[EMAIL-INIT] SendGrid API key present: ${!!process.env.SENDGRID_API_KEY}`,
);
console.log(
  `[EMAIL-INIT] Gmail credentials present: ${!!process.env.EMAIL_USER && !!process.env.EMAIL_PASS}`,
);

const sendEmail = async (options) => {
  if (!validateEmailConfig()) {
    throw new Error("Email configuration missing in environment variables");
  }

  console.log(
    `[EMAIL] Attempting to send email to: ${options.to} via ${process.env.EMAIL_SERVICE || "gmail"}`,
  );

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

  // Determine the from address based on the email service
  const emailService = (process.env.EMAIL_SERVICE || "gmail")
    .toLowerCase()
    .trim();
  const fromEmail =
    emailService === "sendgrid"
      ? process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_USER
      : process.env.EMAIL_USER;

  const mailOptions = {
    from: `"Event Evaluation System" <${fromEmail}>`,
    to: options.to || options.email,
    subject: subject,
    html: htmlContent,
    text: textContent || options.message,
    attachments: options.attachments || [],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(
      `[EMAIL] ✓ Email sent successfully to ${options.to}: ${info.messageId}`,
    );
    return info;
  } catch (error) {
    console.error(
      `[EMAIL] ✗ Failed to send email to ${options.to}:`,
      error.message,
    );
    console.error(`[EMAIL] Error details:`, {
      service: process.env.EMAIL_SERVICE || "gmail",
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });
    throw error;
  }
};

module.exports = {
  sendEmail,
  transporter,
  validateEmailConfig,
};
