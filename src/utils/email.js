const nodemailer = require('nodemailer');
const { generateRatingEmailHtml } = require('./ratingEmailTemplate.js');

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  let htmlContent = options.html || '';
  let subject = options.subject;
  let textContent = options.text;

  // Auto-detect rating email and generate HTML if rating data provided
  if (options.ratingData) {
    htmlContent = generateRatingEmailHtml({
      participantName: options.ratingData.participantName,
      questionText: options.ratingData.questionText,
      ratingScore: options.ratingData.ratingScore,
      maxScore: options.ratingData.maxScore || 10,
      adminName: options.ratingData.adminName || 'Admin/Team'
    });
    subject = options.ratingData.subject || 
      `${options.ratingData.participantName} - Rating Response: ${options.ratingData.questionText} = ${options.ratingData.ratingScore}`;
  }

  const mailOptions = {
    from: `"Event Evaluation System" <${process.env.EMAIL_USER}>`,
    to: options.to || options.email,
    subject: subject,
    html: htmlContent,
    text: textContent || options.message,
  };

  const info = await transporter.sendMail(mailOptions);

  console.log('Rating notification email sent: %s', info.messageId);
  return info;
};

module.exports = sendEmail;
