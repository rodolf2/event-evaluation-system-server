const formsController = require('../src/api/controllers/formsController');
const certificateService = require('../src/services/certificate/certificateService');
const Form = require('../src/models/Form');
const User = require('../src/models/User');
const Event = require('../src/models/Event');
const Certificate = require('../src/models/Certificate');
const Activity = require('../src/models/Activity'); // Import Activity model
const activityService = require('../src/services/activityService'); // Import activityService
const fs = require('fs');
const nodemailer = require('nodemailer'); // Import nodemailer
const PDFDocument = require('pdfkit');

// Mock the models
jest.mock('../src/models/Form');
jest.mock('../src/models/User');
jest.mock('../src/models/Event');
jest.mock('../src/models/Certificate');
jest.mock('../src/models/Activity'); // Mock Activity model

// Mock the Event constructor to return an object with _id
jest.mock('../src/models/Event', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
}));

// Mock other dependencies of certificateService
jest.mock('fs');
jest.mock('pdfkit');
jest.mock('nodemailer'); // Mock nodemailer at the top level

// Mock activityService
jest.mock('../src/services/activityService', () => ({
  logFormSubmitted: jest.fn().mockResolvedValue({}),
  logFormCreated: jest.fn().mockResolvedValue({}),
  logFormPublished: jest.fn().mockResolvedValue({}),
}));

describe('Form Submission and Certificate Generation', () => {
  let certificateServiceSpy;

  beforeEach(() => {
    // Mock implementations for nodemailer
    const mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({}),
    };
    // Directly set the transporter on the imported certificateService instance
    certificateService.transporter = mockTransporter;

    // Spy on the real generateCertificate method
    certificateServiceSpy = jest.spyOn(certificateService, 'generateCertificate');

    // Mock implementations for PDFDocument and fs
    const mockPdfDoc = {
      pipe: jest.fn(),
      font: jest.fn().mockReturnThis(),
      fontSize: jest.fn().mockReturnThis(),
      fillColor: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
      moveTo: jest.fn().mockReturnThis(),
      lineTo: jest.fn().mockReturnThis(),
      stroke: jest.fn().mockReturnThis(),
      save: jest.fn().mockReturnThis(),
      restore: jest.fn().mockReturnThis(),
      rect: jest.fn().mockReturnThis(),
      fill: jest.fn().mockReturnThis(),
      bezierCurveTo: jest.fn().mockReturnThis(),
      closePath: jest.fn().mockReturnThis(),
      strokeColor: jest.fn().mockReturnThis(),
      lineWidth: jest.fn().mockReturnThis(),
      circle: jest.fn().mockReturnThis(),
      translate: jest.fn().mockReturnThis(),
      rotate: jest.fn().mockReturnThis(),
      end: jest.fn(),
      page: { width: 595.28, height: 841.89 },
      currentLineHeight: jest.fn().mockReturnValue(12),
      widthOfString: jest.fn().mockReturnValue(100),
      image: jest.fn(),
    };
    PDFDocument.mockImplementation(() => mockPdfDoc);

    const mockStream = {
      on: jest.fn((event, callback) => {
        if (event === 'finish') {
          callback();
        }
      }),
    };
    fs.createWriteStream.mockReturnValue(mockStream);
    fs.existsSync.mockReturnValue(true);
    fs.mkdirSync.mockReturnValue(undefined);

    // Mock fs.readFileSync for template files
    fs.readFileSync.mockImplementation((path) => {
      if (path.includes('simple-black.json')) {
        return JSON.stringify({
          version: "5.3.0",
          objects: [
            {
              type: "rect",
              left: 0,
              top: 0,
              width: 1056,
              height: 816,
              fill: "#F9FAFB"
            },
            {
              type: "textbox",
              left: 528,
              top: 230,
              width: 500,
              height: 56.5,
              text: "[Recipient Name]",
              fontFamily: "Times New Roman",
              fontWeight: "bold",
              fontSize: 50,
              fill: "#000000"
            }
          ],
          background: "#fff"
        });
      }
      return "{}"; // Default empty JSON for other files
    });

    // Mock the save method for the Certificate model
    Certificate.prototype.save = jest.fn().mockResolvedValue({});
    // Mock the save method for the Activity model
    Activity.prototype.save = jest.fn().mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should generate a certificate with the correct participant name upon form submission', async () => {
    // Arrange
    const participantName = 'John Doe';
    const participantEmail = 'john.doe@example.com';
    const mockUserId = '60d5ec49f8c7a10015a4b7c8'; // Valid ObjectId string

    const mockForm = {
      _id: 'form123',
      event: 'event123',
      status: 'published',
      title: 'Test Form',
      questions: [{ _id: 'q1', title: 'Test Question', type: 'text' }],
      attendeeList: [
        { userId: mockUserId, name: participantName, email: participantEmail, certificateSent: false },
      ],
      responses: [],
    };
    mockForm.save = jest.fn().mockResolvedValue(mockForm);

    const mockUser = { _id: mockUserId, name: 'Test User', email: 'test@example.com' };
    const mockEvent = { _id: 'event123', name: 'Test Form', title: 'Test Form' }; // Change name to match form title

    Form.findById.mockResolvedValue(mockForm);
    User.findById.mockResolvedValue(mockUser);
    Event.findById.mockResolvedValue(mockEvent);
    Event.findOne.mockImplementation(({ name }) => {
      if (name === 'Test Form') {
        return mockEvent;
      }
      return null;
    });
    Certificate.findOne.mockResolvedValue(null);

    const req = {
      params: { id: 'form123' },
      body: {
        respondentEmail: participantEmail,
        respondentName: participantName,
        responses: [{ questionId: 'q1', answer: 'a1' }],
      },
      user: { _id: mockUserId, email: 'test@example.com' },
      connection: { remoteAddress: '127.0.0.1' },
      get: jest.fn((header) => {
        if (header === 'User-Agent') return 'jest-test';
        if (header === 'Referer') return 'http://localhost';
        return null;
      }),
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    // Act
    await formsController.submitFormResponse(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: "Response submitted successfully",
    }));

    expect(certificateServiceSpy).toHaveBeenCalledTimes(1);
    expect(certificateServiceSpy).toHaveBeenCalledWith(
      mockUserId, // userId
      'event123',
      expect.objectContaining({
        formId: 'form123',
        respondentEmail: participantEmail,
        respondentName: participantName,
        studentName: participantName,
      })
    );
  }, 10000); // Increase timeout to 10 seconds

  it('should generate a certificate using the linked template when form has certificate linking enabled', async () => {
    // Arrange
    const participantName = 'Jane Smith';
    const participantEmail = 'jane.smith@example.com';
    const linkedTemplateId = 'simple-black';
    const mockUserId = '60d5ec49f8c7a10015a4b7c9'; // Valid ObjectId string

    const mockForm = {
      _id: 'form456',
      event: 'event456',
      status: 'published',
      title: 'Linked Certificate Form',
      questions: [{ _id: 'q1', title: 'Test Question', type: 'text' }],
      attendeeList: [
        { userId: mockUserId, name: participantName, email: participantEmail, certificateSent: false },
      ],
      responses: [],
      // Certificate linking fields
      isCertificateLinked: true,
      linkedCertificateId: linkedTemplateId,
      linkedCertificateType: 'completion',
      certificateTemplateName: 'Simple Black Certificate',
    };
    mockForm.save = jest.fn().mockResolvedValue(mockForm);

    const mockUser = { _id: mockUserId, name: 'Test User', email: 'test@example.com' };
    const mockEvent = { _id: 'event456', name: 'Linked Certificate Form', title: 'Linked Certificate Form' };

    Form.findById.mockResolvedValue(mockForm);
    User.findById.mockResolvedValue(mockUser);
    Event.findById.mockResolvedValue(mockEvent);
    Event.findOne.mockImplementation(({ name }) => {
      if (name === 'Linked Certificate Form') {
        return mockEvent;
      }
      return null;
    });
    Certificate.findOne.mockResolvedValue(null);

    const req = {
      params: { id: 'form456' },
      body: {
        respondentEmail: participantEmail,
        respondentName: participantName,
        responses: [{ questionId: 'q1', answer: 'a1' }],
      },
      user: { _id: mockUserId, email: 'test@example.com' },
      connection: { remoteAddress: '127.0.0.1' },
      get: jest.fn((header) => {
        if (header === 'User-Agent') return 'jest-test';
        if (header === 'Referer') return 'http://localhost';
        return null;
      }),
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    // Act
    await formsController.submitFormResponse(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: "Response submitted successfully",
    }));

    expect(certificateServiceSpy).toHaveBeenCalledTimes(1);
    expect(certificateServiceSpy).toHaveBeenCalledWith(
      mockUserId, // userId
      'event456',
      expect.objectContaining({
        formId: 'form456',
        respondentEmail: participantEmail,
        respondentName: participantName,
        studentName: participantName,
        templateId: linkedTemplateId, // Should use the linked template
      })
    );
  }, 10000); // Increase timeout to 10 seconds
});