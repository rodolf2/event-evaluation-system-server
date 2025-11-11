const mongoose = require('mongoose');
const Form = require('./src/models/Form');
const User = require('./src/models/User');
const analyticsController = require('./src/api/controllers/analyticsController');

// Mock Express request/response objects
const mockReq = {
  user: {
    _id: null // Will be set after user creation
  },
  params: {
    formId: null // Will be set after form creation
  }
};

const mockRes = {
  status: function(code) {
    this.statusCode = code;
    return this;
  },
  json: function(data) {
    console.log('Response Status:', this.statusCode);
    console.log('Response Data:', JSON.stringify(data, null, 2));
    return data;
  }
};

async function testAnalytics() {
  try {
    // Connect to database (assuming local MongoDB)
    await mongoose.connect('mongodb://localhost:27017/event_evaluation_system', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Create a test user (PSAS role)
    const testUser = new User({
      name: 'Test PSAS User',
      email: 'psas@test.com',
      role: 'psas'
    });
    await testUser.save();
    mockReq.user._id = testUser._id;
    console.log('✅ Created test user:', testUser.email);

    // Create a test form with attendee data
    const testForm = new Form({
      title: 'Test Event Evaluation',
      description: 'A test form for analytics testing',
      status: 'published',
      publishedAt: new Date(),
      createdBy: testUser._id,
      attendeeList: [
        {
          name: 'John Doe',
          email: 'john@example.com',
          hasResponded: false
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          hasResponded: true
        },
        {
          name: 'Bob Johnson',
          email: 'bob@example.com',
          hasResponded: true
        },
        {
          name: 'Alice Brown',
          email: 'alice@example.com',
          hasResponded: false
        },
        {
          name: 'Charlie Wilson',
          email: 'charlie@example.com',
          hasResponded: true
        }
      ],
      questions: [
        {
          title: 'How would you rate this event?',
          type: 'scale',
          required: true,
          low: 1,
          high: 5,
          lowLabel: 'Poor',
          highLabel: 'Excellent'
        },
        {
          title: 'What did you like most about the event?',
          type: 'paragraph',
          required: false
        },
        {
          title: 'What could be improved?',
          type: 'paragraph',
          required: false
        }
      ]
    });

    // Add sample responses
    testForm.responses = [
      {
        respondentEmail: 'jane@example.com',
        respondentName: 'Jane Smith',
        responses: [
          {
            questionId: 'q1',
            questionTitle: 'How would you rate this event?',
            answer: 4
          },
          {
            questionId: 'q2',
            questionTitle: 'What did you like most about the event?',
            answer: 'The speakers were excellent and the content was very informative. I really enjoyed the interactive sessions.'
          },
          {
            questionId: 'q3',
            questionTitle: 'What could be improved?',
            answer: 'The venue was a bit cramped, but overall it was a great event.'
          }
        ],
        submittedAt: new Date(Date.now() - 86400000) // 1 day ago
      },
      {
        respondentEmail: 'bob@example.com',
        respondentName: 'Bob Johnson',
        responses: [
          {
            questionId: 'q1',
            questionTitle: 'How would you rate this event?',
            answer: 5
          },
          {
            questionId: 'q2',
            questionTitle: 'What did you like most about the event?',
            answer: 'Amazing experience! The workshops were fantastic and I learned so much.'
          },
          {
            questionId: 'q3',
            questionTitle: 'What could be improved?',
            answer: 'Everything was perfect. No complaints at all!'
          }
        ],
        submittedAt: new Date(Date.now() - 43200000) // 12 hours ago
      },
      {
        respondentEmail: 'charlie@example.com',
        respondentName: 'Charlie Wilson',
        responses: [
          {
            questionId: 'q1',
            questionTitle: 'How would you rate this event?',
            answer: 3
          },
          {
            questionId: 'q2',
            questionTitle: 'What did you like most about the event?',
            answer: 'The networking opportunities were good.'
          },
          {
            questionId: 'q3',
            questionTitle: 'What could be improved?',
            answer: 'The schedule was too packed and some sessions ran over time.'
          }
        ],
        submittedAt: new Date(Date.now() - 7200000) // 2 hours ago
      }
    ];

    testForm.responseCount = testForm.responses.length;
    await testForm.save();
    mockReq.params.formId = testForm._id;
    console.log('✅ Created test form with', testForm.attendeeList.length, 'attendees and', testForm.responses.length, 'responses');

    // Test the analytics API
    console.log('\n🔍 Testing Analytics API...');
    await analyticsController.getFormAnalytics(mockReq, mockRes);

    // Clean up test data
    await Form.findByIdAndDelete(testForm._id);
    await User.findByIdAndDelete(testUser._id);
    console.log('\n🧹 Cleaned up test data');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    console.log('\n🎉 Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Check if MongoDB is running locally
const { exec } = require('child_process');

exec('mongod --version', (error) => {
  if (error) {
    console.log('⚠️  MongoDB not found locally. Make sure MongoDB is running or update the connection string in test-analytics.js');
    console.log('   Default connection: mongodb://localhost:27017/event_evaluation_system');
    process.exit(1);
  } else {
    testAnalytics();
  }
});