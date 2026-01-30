/**
 * Generates HTML for form assignment notification email
 * 
 * @param {Object} params
 * @param {string} params.name - Attendee name
 * @param {string} params.formTitle - Title of the form
 * @param {string} params.shareableLink - Link to the form
 * @param {string} [params.eventDate] - Date of the event (optional)
 * @returns {string} HTML content
 */
const generateFormAssignmentEmailHtml = ({
    name,
    formTitle,
    shareableLink,
    eventDate,
}) => {
    const formattedDate = eventDate
        ? new Date(eventDate).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        })
        : null;

    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1F3463 0%, #2d4a8c 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">New Evaluation Assigned</h1>
        <p style="color: #e0e7ff; margin: 10px 0 0 0;">La Verdad Christian College - Event Evaluation System</p>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; color: #374151;">Hello <strong>${name}</strong>,</p>
        
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          You have been assigned to complete an evaluation for:
        </p>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-weight: bold; color: #1F3463; font-size: 18px;">${formTitle}</p>
          ${formattedDate ? `<p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">Event Date: ${formattedDate}</p>` : ""}
        </div>
        
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Your feedback is important to us. Please click the button below to access and complete the evaluation form.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${shareableLink}" 
             style="display: inline-block; background: #1F3463; color: white; padding: 14px 28px; 
                    text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            Complete Form
          </a>
        </div>
        
        <p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${shareableLink}" style="color: #1F3463; word-break: break-all;">${shareableLink}</a>
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">
          © ${new Date().getFullYear()} La Verdad Christian College - Apalit, Pampanga
        </p>
      </div>
    </div>
  `;
};

module.exports = { generateFormAssignmentEmailHtml };
