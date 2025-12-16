const generateEvaluatorAccessEmailHtml = ({
  name,
  eventName,
  formTitle,
  accessLink,
  expiresAt,
}) => {
  const expiryDate = new Date(expiresAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1F3463 0%, #2d4a8c 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Event Evaluation</h1>
        <p style="color: #e0e7ff; margin: 10px 0 0 0;">La Verdad Christian College - Event Evaluation System</p>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; color: #374151;">Hello <strong>${name}</strong>,</p>
        
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          You are invited to provide feedback for:
        </p>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-weight: bold; color: #1F3463; font-size: 18px;">${eventName}</p>
          <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">${formTitle}</p>
        </div>
        
        <p style="font-size: 14px; color: #6b7280; margin-bottom: 20px;">
          Please complete the evaluation before <strong>${expiryDate}</strong>.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${accessLink}" 
             style="display: inline-block; background: #1F3463; color: white; padding: 14px 28px; 
                    text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            Complete Evaluation
          </a>
        </div>
        
        <p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${accessLink}" style="color: #1F3463; word-break: break-all;">${accessLink}</a>
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">
          © ${new Date().getFullYear()} La Verdad Christian College - Apalit, Pampanga
        </p>
      </div>
    </div>
  `;
};

module.exports = { generateEvaluatorAccessEmailHtml };
