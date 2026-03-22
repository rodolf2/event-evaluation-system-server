# Certificate Generator Backend

A comprehensive certificate generation system for the Event Evaluation platform, built with Node.js, Express.js, and PDFKit.

## Features

- **Professional PDF Certificates**: Generate beautifully designed certificates with custom styling
- **Automated Email Distribution**: Send certificates directly to participants via email
- **Bulk Certificate Generation**: Generate certificates for multiple participants at once
- **Certificate Management**: Store, retrieve, and manage certificates in MongoDB
- **Customizable Templates**: Support for different certificate types and custom messages
- **Download Support**: Allow users to download certificates directly from the platform

## Technology Stack

- **Backend**: Node.js, Express.js
- **PDF Generation**: PDFKit
- **Email Service**: Nodemailer
- **Database**: MongoDB with Mongoose
- **File Storage**: Local file system for PDF storage

## Installation

1. **Install Dependencies**
   ```bash
   npm install pdfkit nodemailer
   ```

2. **Environment Setup**
   Create a `.env` file based on `.env.example`:
   ```env
   MONGODB_URI=mongodb://localhost:27017/event-evaluation-system
   PORT=5000
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   ```

3. **Gmail Setup for Email**
   - Enable 2-factor authentication on your Gmail account
   - Generate an App Password: Google Account → Security → App passwords
   - Use the App Password in `EMAIL_PASS`

## API Endpoints

### Generate Single Certificate
```http
POST /api/certificates/generate
Content-Type: application/json
Accept: application/json

{
  "userId": "user_id_here",
  "eventId": "event_id_here",
  "certificateType": "participation",
  "customMessage": "Optional custom message",
  "sendEmail": true
}
```

### Generate Bulk Certificates
```http
POST /api/certificates/generate-bulk
Content-Type: application/json
Accept: application/json

{
  "eventId": "event_id_here",
  "participantIds": ["user1_id", "user2_id", "user3_id"],
  "certificateType": "participation",
  "customMessage": "Optional custom message",
  "sendEmail": true
}
```

### Get Certificate
```http
GET /api/certificates/:certificateId
```

### Download Certificate
```http
GET /api/certificates/download/:certificateId
```

### Get User Certificates
```http
GET /api/certificates/user/:userId?page=1&limit=10
```

### Get Event Certificates
```http
GET /api/certificates/event/:eventId?page=1&limit=10
```

### Resend Certificate Email
```http
POST /api/certificates/:certificateId/resend
```

### Delete Certificate
```http
DELETE /api/certificates/:certificateId
```

### Get Certificate Statistics
```http
GET /api/certificates/stats
```

## Certificate Types

- `participation`: Standard participation certificate
- `completion`: For completed courses or programs
- `achievement`: For special achievements or awards

## Dynamic Content

The certificate system generates dynamic, context-aware descriptions based on:

- **Event Name**: Automatically included in the certificate text
- **Event Date**: Formatted and included in the description
- **Certificate Type**: Different wording for participation, completion, or achievement
- **Custom Messages**: Optional custom text that overrides the default description
- **Institution**: Always includes "La Verdad Christian College - Apalit, Pampanga"

### Default Descriptions by Type

**Participation Certificate:**
```
"For outstanding participation and valuable contribution to [Event Name] held on [Date] at La Verdad Christian College - Apalit, Pampanga. This certificate recognizes dedication, enthusiasm, and commitment demonstrated throughout the event."
```

**Completion Certificate:**
```
"For successfully completing [Event Name] held on [Date] at La Verdad Christian College - Apalit, Pampanga. This certificate acknowledges the successful fulfillment of all requirements and active engagement throughout the program."
```

**Achievement Certificate:**
```
"For exceptional achievement and distinguished performance in [Event Name] held on [Date] at La Verdad Christian College - Apalit, Pampanga. This certificate honors the remarkable accomplishments and dedication shown during the event."
```

**Custom Message:**
When `customMessage` is provided in the API request, it completely replaces the default description with your custom text.

## Certificate Design Features

- **Professional Layout**: Landscape A4 format with gold decorative corner elements
- **Gold Seal**: Decorative gold medal/seal on the left side of the certificate
- **Navy Blue Theme**: Professional navy blue borders and titles (#1e3a8a)
- **Gold Accents**: Participant names in gold/brown (#b45309) with decorative corners
- **Clean Typography**:
  - "CERTIFICATE OF PARTICIPATION" in navy blue
  - "This certificate is proudly presented to" subtitle
  - Large gold participant name as focal point
  - Professional event description text
- **Official Signatures**: Two signature lines for Chancellor/Administrator and PSAS Department Head
- **Institutional Branding**: "La Verdad Christian College - Apalit, Pampanga" at bottom
- **Unique Certificate ID**: For tracking and verification (bottom center)
- **High Contrast**: White background with dark text for excellent readability

## Usage Examples

### Generate Certificate for Event Participant
```javascript
const response = await fetch('/api/certificates/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  body: JSON.stringify({
    userId: '60d5ecb74b24c72b8c8b4567',
    eventId: '60d5ecb74b24c72b8c8b4568',
    certificateType: 'participation',
    customMessage: 'Thank you for your active participation!',
    sendEmail: true
  })
});

const result = await response.json();
console.log('Certificate generated:', result.data.certificateId);
```

### Generate Certificates for All Event Participants
```javascript
const response = await fetch('/api/certificates/generate-bulk', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  body: JSON.stringify({
    eventId: '60d5ecb74b24c72b8c8b4568',
    participantIds: [
      '60d5ecb74b24c72b8c8b4567',
      '60d5ecb74b24c72b8c8b4569',
      '60d5ecb74b24c72b8c8b4570'
    ],
    certificateType: 'participation',
    sendEmail: true
  })
});

const result = await response.json();
console.log(`Generated ${result.data.filter(r => r.success).length} certificates`);
```

## File Structure

```
src/
├── models/
│   └── Certificate.js              # Certificate data model
├── services/
│   └── certificate/
│       └── certificateService.js   # PDF generation and email service
├── api/
│   ├── controllers/
│   │   └── certificateController.js # API endpoints logic
│   └── routes/
│       └── certificateRoutes.js    # Route definitions
└── uploads/
    └── certificates/               # Generated PDF storage
```

## Email Configuration

The system uses Nodemailer with Gmail SMTP. To set up:

1. **Enable Gmail SMTP**:
   - Go to Google Account settings
   - Enable "Less secure app access" OR use App Passwords

2. **App Password Setup** (Recommended):
   - Enable 2FA on Gmail
   - Generate App Password: Security → App passwords → Generate
   - Use 16-character password in `EMAIL_PASS`

3. **Environment Variables**:
   ```env
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-16-character-app-password
   ```

## Error Handling

The system includes comprehensive error handling for:
- Invalid user/event IDs
- Missing certificate files
- Email delivery failures
- Database connection issues
- File system errors

## Security Considerations

- **File Access Control**: Certificates are stored in protected directories
- **Email Validation**: Only send certificates to verified email addresses
- **Rate Limiting**: Consider implementing rate limits for bulk operations
- **Input Validation**: All inputs are validated and sanitized
- **Error Information**: Sensitive error details not exposed in responses

## Future Enhancements

- **Digital Signatures**: Add cryptographic signatures for certificate verification
- **QR Codes**: Include QR codes linking to digital verification
- **Template Customization**: Allow custom certificate templates
- **Batch Processing**: Improved bulk processing with progress tracking
- **Cloud Storage**: Store certificates in cloud storage (AWS S3, Google Cloud)
- **Certificate Verification API**: Public API for certificate verification

## Troubleshooting

### Common Issues

1. **PDF Generation Fails**
   - Check file permissions in `src/uploads/certificates/`
   - Ensure sufficient disk space

2. **Email Not Sending**
   - Verify Gmail credentials and App Password
   - Check spam folder
   - Ensure 2FA is enabled with App Password

3. **Database Connection Issues**
   - Verify MongoDB connection string
   - Check network connectivity
   - Ensure MongoDB is running

4. **Request Body Undefined Error**
   - Ensure requests include proper headers: `Content-Type: application/json` and `Accept: application/json`
   - Verify the request body is valid JSON
   - Check that the server is running and middleware is properly configured

5. **Certificate Text Not Visible (White Text Issue)**
   - Fixed: Updated color scheme for better contrast
   - Dark text (#1a365d, #2d3748) on light background (#FDFDFD)
   - Red accent (#c53030) for participant names
   - All new certificates will have proper visibility

6. **PDFKit Syntax Errors (strokeWidth not a function)**
   - Fixed: Use `.lineWidth()` instead of `.strokeWidth()` in PDFKit
   - Set stroke properties before drawing: `.strokeColor().lineWidth().moveTo().lineTo().stroke()`
   - PDFKit methods are not always chainable - call `.stroke()` after path operations

### Logs

Check the console output for detailed error messages. The system logs:
- Certificate generation progress
- Email sending status
- Database operations
- File system operations

## Contributing

When adding new features:
1. Follow existing code structure and naming conventions
2. Add proper error handling and validation
3. Update this documentation
4. Test thoroughly with different scenarios
5. Consider security implications

## License

This certificate generator is part of the Event Evaluation System for La Verdad Christian College - Apalit, Pampanga.