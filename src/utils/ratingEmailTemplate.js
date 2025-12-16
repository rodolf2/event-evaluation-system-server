const generateRatingEmailHtml = ({
  participantName,
  questionText,
  ratingScore,
  maxScore = 10,
  adminName = "Admin/Team",
}) => {
  const filledStars = Math.floor(ratingScore);
  const hasHalfStar = ratingScore % 1 >= 0.5;
  const stars = Array(5)
    .fill()
    .map((_, i) => {
      if (i < filledStars) return "★";
      if (i === filledStars && hasHalfStar) return "☆";
      return "☆";
    })
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rating Response Received</title>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      max-width: 600px;
      margin: 0 auto;
      background-color: #f9fafb;
      padding: 20px;
    }
    
    .email-container {
      background-color: #f9fafb;
    }
    
    .header {
      background: linear-gradient(-0.15deg, #324BA3 38%, #002474 100%);
      padding: 2rem;
      text-align: center;
      color: white;
      border-radius: 12px 12px 0 0;
      margin-bottom: 0;
    }
    
    .header h1 {
      font-size: 1.5rem;
      font-weight: 700;
      margin: 0 0 0.5rem 0;
      text-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    
    .content {
      background: white;
      padding: 2.5rem;
      border-radius: 0 0 12px 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0,0, 0.1), 0 10px 10px -5px rgba(0, 0,0, 0.04);
    }
    
    .rating-display {
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      border-radius: 16px;
      padding: 2.5rem;
      text-align: center;
      border: 1px solid #e2e8f0;
      margin-bottom: 2rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0,0, 0.1);
    }
    
    .rating-score {
      font-size: 4rem;
      font-weight: 800;
      color: #1e40af;
      margin-bottom: 1rem;
    }
    
    .rating-stars {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }
    
    .rating-badge {
      font-size: 1.2rem;
      color: #64748b;
      font-weight: 600;
      background: rgba(59, 130, 246, 0.1);
      padding: 0.75rem 1.5rem;
      border-radius: 9999px;
      display: inline-block;
    }
    
    .info-section {
      background: rgba(59, 130, 246, 0.05);
      border-left: 4px solid #3b82f6;
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 2rem;
    }
    
    .info-section p {
      margin: 0;
      font-size: 0.95rem;
      color: #1e40af;
    }
    
    .info-section p:first-child {
      margin-bottom: 0.5rem;
    }
    
    .footer-section {
      text-align: center;
      padding-top: 2rem;
      border-top: 1px solid #e5e7eb;
      font-size: 0.9rem;
      color: #6b7280;
    }
    
    .footer-section p {
      margin: 0;
      font-weight: 500;
    }
    
    .footer-section p:last-child {
      margin-top: 0.25rem;
      font-weight: 600;
      color: #1e40af;
    }
    
    .email-footer {
      text-align: center;
      padding: 2rem 1rem 1rem;
      color: #9ca3af;
      font-size: 0.8rem;
    }
    
    .email-footer p {
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <!-- Header -->
    <div class="header">
      <h1>📊 Rating Response Received</h1>
    </div>

    <!-- Content -->
    <div class="content">
      <div style="margin-bottom: 2rem;">
        <p style="font-size: 1.1rem; color: #374151; margin-bottom: 1rem;">
          <strong>Dear ${adminName},</strong>
        </p>
        <p style="font-size: 1rem; color: #6b7280; margin-bottom: 1.5rem;">
          ${participantName} has submitted their rating for <strong>"${questionText}"</strong>:
        </p>
      </div>

      <!-- Rating Display -->
      <div class="rating-display">
        <div class="rating-score">
          ${ratingScore.toFixed(1)}
        </div>
        <div class="rating-stars">
          ${stars}
        </div>
        <div class="rating-badge">
          ${ratingScore}/${maxScore}
        </div>
      </div>

      <div class="info-section">
        <p><strong>Participant:</strong> ${participantName}</p>
        <p><strong>Question:</strong> ${questionText}</p>
      </div>

      <div class="footer-section">
        <p>Best regards,</p>
        <p>Participant Feedback System</p>
      </div>
    </div>

    <!-- Footer -->
    <div class="email-footer">
      <p>This is an automated message from the Event Evaluation System.</p>
    </div>
  </div>
</body>
</html>
`;
};

module.exports = { generateRatingEmailHtml };
