const nodemailer = require("nodemailer");
const { Resend } = require("resend");
const axios = require("axios");
const sgMail = require("@sendgrid/mail");
const { generateRatingEmailHtml } = require("./ratingEmailTemplate.js");

/**
 * Validates email environment variables based on service
 */
const validateEmailConfig = () => {
  const emailService = (process.env.EMAIL_SERVICE || "gmail")
    .toLowerCase()
    .trim();

  if (emailService === "resend") {
    if (!process.env.RESEND_API_KEY) {
      console.error(
        "❌ [EMAIL-CONFIG] Resend API key missing. Set RESEND_API_KEY environment variable.",
      );
      return false;
    }
  } else if (emailService === "brevo") {
    if (!process.env.BREVO_API_KEY) {
      console.error(
        "❌ [EMAIL-CONFIG] Brevo API key missing. Set BREVO_API_KEY environment variable.",
      );
      return false;
    }
  } else if (emailService === "sendgrid") {
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
  } else if (emailService === "smtp") {
    if (
      !process.env.EMAIL_HOST ||
      !process.env.EMAIL_USER ||
      !process.env.EMAIL_PASS
    ) {
      console.error(
        "❌ [EMAIL-CONFIG] SMTP config missing. Set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS.",
      );
      return false;
    }
  } else {
    console.error(
      `❌ [EMAIL-CONFIG] Invalid EMAIL_SERVICE: ${emailService}. Use 'sendgrid', 'brevo', 'resend', 'gmail', or 'smtp'.`,
    );
    return false;
  }

  return true;
};

/**
 * Creates Resend client instance
 */
const createResendClient = () => {
  if (!process.env.RESEND_API_KEY) {
    console.error("[EMAIL-RESEND] Resend API key missing!");
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
};

/**
 * Create Generic SMTP transporter
 */
const createSmtpTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || "587"),
    secure: process.env.EMAIL_SECURE === "true", // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false, // Helpful for local dev with self-signed certs
    },
    pool: true, // Use connection pooling
    maxConnections: 5,
    maxMessages: 10,
    connectionTimeout: 20000, // Increased from 10s
    greetingTimeout: 20000, // Increased from 5s
    socketTimeout: 30000, // Increased from 10s
  });
};

/**
 * Create Gmail transporter (fallback)
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
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
  });
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

  if (emailService === "resend") {
    console.log(
      `[EMAIL-TRANSPORTER] Resend API key present: ${!!process.env.RESEND_API_KEY}`,
    );

    if (!process.env.RESEND_API_KEY) {
      console.error(
        `[EMAIL-TRANSPORTER] Resend API key missing! Falling back to Gmail.`,
      );
      return createGmailTransporter();
    }

    // Return null for Resend - we use the client directly instead of a transporter
    return null;
  } else if (emailService === "smtp") {
    console.log(`[EMAIL-TRANSPORTER] Using Generic SMTP configuration`);
    return createSmtpTransporter();
  } else {
    console.log(`[EMAIL-TRANSPORTER] Using Gmail configuration`);
    return createGmailTransporter();
  }
};

// Initialize based on service
const configuredService = (process.env.EMAIL_SERVICE || "gmail")
  .toLowerCase()
  .trim();

// Create transporter (null for Resend, nodemailer transport for Gmail)
const transporter = createEmailTransporter();

// Create Resend client if using Resend
const resendClient =
  configuredService === "resend" ? createResendClient() : null;

// Log email service configuration on startup
console.log(
  `[EMAIL-INIT] EMAIL_SERVICE env var: "${process.env.EMAIL_SERVICE || "not set"}"`,
);
console.log(`[EMAIL-INIT] Resolved service: ${configuredService}`);
console.log(
  `[EMAIL-INIT] Resend API key present: ${!!process.env.RESEND_API_KEY}`,
);
console.log(
  `[EMAIL-INIT] Brevo API key present: ${!!process.env.BREVO_API_KEY}`,
);
console.log(
  `[EMAIL-INIT] Brevo API key preview: ${process.env.BREVO_API_KEY ? process.env.BREVO_API_KEY.substring(0, 10) + "..." : "NOT SET"}`,
);
console.log(
  `[EMAIL-INIT] SendGrid API key present: ${!!process.env.SENDGRID_API_KEY}`,
);
console.log(
  `[EMAIL-INIT] Gmail credentials present: ${!!process.env.EMAIL_USER && !!process.env.EMAIL_PASS}`,
);

// Initialize SendGrid if configured
if ((process.env.EMAIL_SERVICE || "").toLowerCase().trim() === "sendgrid" && process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log("[EMAIL-INIT] SendGrid initialized.");
}

/**
 * Send email via SendGrid HTTP API
 */
const sendViaSendGrid = async (mailOptions) => {
  const fromEmail =
    process.env.EMAIL_FROM ||
    process.env.SENDGRID_FROM_EMAIL ||
    process.env.EMAIL_USER;

  const toAddresses = Array.isArray(mailOptions.to)
    ? mailOptions.to
    : [mailOptions.to];

  const msg = {
    to: toAddresses,
    from: { name: "Event Evaluation System", email: fromEmail },
    subject: mailOptions.subject,
    html: mailOptions.html || mailOptions.text || "",
  };

  // Attach files as base64 if any
  if (mailOptions.attachments && mailOptions.attachments.length > 0) {
    const fs = require("fs");
    msg.attachments = mailOptions.attachments.map((att) => ({
      filename: att.filename,
      content: (att.content
        ? att.content
        : fs.readFileSync(att.path)
      ).toString("base64"),
      type: "application/pdf",
      disposition: "attachment",
    }));
  }

  const [response] = await sgMail.send(msg);
  const messageId = response.headers["x-message-id"] || "sent";
  console.log(`[EMAIL-SENDGRID] ✓ Email sent via SendGrid, messageId: ${messageId}`);
  return { messageId };
};

/**
 * Send email via Brevo HTTP API (avoids SMTP port blocking on cloud hosts)
 */
const sendViaBrevo = async (mailOptions) => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error("Brevo API key not configured");
  }

  const fromEmail =
    process.env.EMAIL_FROM ||
    process.env.BREVO_FROM_EMAIL ||
    "noreply@laverdad.edu.ph";
  const fromName = "Event Evaluation System";

  // Build recipients array
  const toAddresses = Array.isArray(mailOptions.to)
    ? mailOptions.to
    : [mailOptions.to];

  const payload = {
    sender: { name: fromName, email: fromEmail },
    to: toAddresses.map((email) => ({ email })),
    subject: mailOptions.subject,
    htmlContent: mailOptions.html || mailOptions.text || "",
  };

  // Attach files as base64 if any
  if (mailOptions.attachments && mailOptions.attachments.length > 0) {
    const fs = require("fs");
    payload.attachment = mailOptions.attachments.map((att) => ({
      name: att.filename,
      content: (att.content
        ? att.content
        : fs.readFileSync(att.path)
      ).toString("base64"),
    }));
  }

  const response = await axios.post(
    "https://api.brevo.com/v3/smtp/email",
    payload,
    {
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    },
  );

  console.log(`[EMAIL-BREVO] ✓ Email sent via Brevo API, messageId: ${response.data.messageId}`);
  return { messageId: response.data.messageId };
};

/**
 * Send email via Resend API
 */
const sendViaResend = async (mailOptions) => {
  if (!resendClient) {
    throw new Error("Resend client not initialized");
  }

  const { data, error } = await resendClient.emails.send({
    from: mailOptions.from,
    to: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to],
    subject: mailOptions.subject,
    html: mailOptions.html,
    text: mailOptions.text,
    attachments: mailOptions.attachments?.map((att) => ({
      filename: att.filename,
      content: att.content || require("fs").readFileSync(att.path),
    })),
  });

  if (error) {
    throw new Error(error.message);
  }

  return { messageId: data.id };
};

/**
 * Send email via Transporter (Gmail or Generic SMTP)
 */
const sendViaTransporter = async (mailOptions) => {
  if (!transporter) {
    throw new Error("Email transporter not initialized");
  }
  return await transporter.sendMail(mailOptions);
};

const sendEmail = async (options) => {
  if (!validateEmailConfig()) {
    throw new Error("Email configuration missing in environment variables");
  }

  const emailService = (process.env.EMAIL_SERVICE || "gmail")
    .toLowerCase()
    .trim();

  console.log(
    `[EMAIL] Attempting to send email to: ${options.to} via ${emailService}`,
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
  const fromEmail =
    process.env.EMAIL_FROM ||
    (emailService === "resend"
      ? process.env.RESEND_FROM_EMAIL || "noreply@resend.dev"
      : process.env.EMAIL_USER);

  const mailOptions = {
    from: `"Event Evaluation System" <${fromEmail}>`,
    to: options.to || options.email,
    subject: subject,
    html: htmlContent,
    text: textContent || options.message,
    attachments: options.attachments || [],
  };

  try {
    let info;
    if (emailService === "sendgrid") {
      info = await sendViaSendGrid(mailOptions);
    } else if (emailService === "resend") {
      info = await sendViaResend(mailOptions);
    } else if (emailService === "brevo") {
      info = await sendViaBrevo(mailOptions);
    } else {
      info = await sendViaTransporter(mailOptions);
    }

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
      service: emailService,
      code: error.code,
      message: error.message,
    });
    throw error;
  }
};

console.log("[EMAIL-DEBUG] Exporting:", { 
  hasSendEmail: typeof sendEmail, 
  hasResendClient: typeof resendClient 
});

module.exports = {
  sendEmail,
  transporter,
  validateEmailConfig,
  resendClient,
};
