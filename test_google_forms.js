#!/usr/bin/env node

/**
 * Test script for Google Forms extraction functionality
 * Usage: node test_google_forms.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000';
const API_ENDPOINT = `${BASE_URL}/api/google-forms`;

// Test data
const TEST_FORMS = [
  {
    name: 'Valid Google Form URL (standard)',
    url: 'https://docs.google.com/forms/d/1FAIpQLSdM8K5QY6M7N9YZ4LMKZHbNsQs5V9k-example/viewform'
  },
  {
    name: 'Valid Google Form URL (short)',
    url: 'https://forms.gle/exampleShortUrl'
  },
  {
    name: 'Invalid URL',
    url: 'https://www.example.com/not-a-form'
  }
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Helper functions
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logTest(testName) {
  console.log('\n' + '-'.repeat(40));
  log(`Test: ${testName}`, 'blue');
  console.log('-'.repeat(40));
}

// Test functions
async function testValidateUrl(formUrl) {
  try {
    const response = await axios.post(`${API_ENDPOINT}/validate`, {
      formUrl
    });

    if (response.data.success) {
      log('✓ URL validation successful', 'green');
      console.log('  Valid:', response.data.isValid);
      console.log('  Message:', response.data.message);
      if (response.data.viewformUrl) {
        console.log('  Viewform URL:', response.data.viewformUrl);
      }
    }
    return response.data;
  } catch (error) {
    log('✗ URL validation failed', 'red');
    console.error('  Error:', error.response?.data?.error || error.message);
    return null;
  }
}

async function testExtractQuestions(formUrl) {
  try {
    log('Extracting form questions...', 'yellow');
    
    const response = await axios.post(`${API_ENDPOINT}/extract`, {
      formUrl
    });

    if (response.data.success) {
      log('✓ Form extraction successful', 'green');
      const data = response.data.data;
      
      console.log('\nForm Details:');
      console.log('  Title:', data.title || 'N/A');
      console.log('  Description:', data.description || 'N/A');
      console.log('  Total Questions:', data.totalQuestions);
      console.log('  Sections:', data.sections.length);
      
      if (data.sections.length > 0) {
        console.log('\nSections:');
        data.sections.forEach((section, index) => {
          console.log(`  ${index + 1}. ${section.title}`);
          if (section.description) {
            console.log(`     Description: ${section.description}`);
          }
          console.log(`     Questions: ${section.questions.length}`);
        });
      }
      
      if (data.questions.length > 0) {
        console.log('\nSample Questions (first 3):');
        data.questions.slice(0, 3).forEach((question, index) => {
          console.log(`  ${index + 1}. ${question.text}`);
          console.log(`     Type: ${question.type}`);
          console.log(`     Required: ${question.required}`);
          if (question.options && question.options.length > 0) {
            console.log(`     Options: ${question.options.join(', ')}`);
          }
        });
      }
    }
    return response.data;
  } catch (error) {
    log('✗ Form extraction failed', 'red');
    console.error('  Error:', error.response?.data?.error || error.message);
    return null;
  }
}

async function testBatchExtraction() {
  logTest('Batch Extraction');
  
  try {
    const formUrls = TEST_FORMS.slice(0, 2).map(f => f.url);
    
    log('Testing batch extraction with multiple forms...', 'yellow');
    
    const response = await axios.post(`${API_ENDPOINT}/extract-batch`, {
      formUrls
    });

    if (response.data.success) {
      log('✓ Batch extraction completed', 'green');
      console.log('  Total forms:', response.data.summary.total);
      console.log('  Successful:', response.data.summary.successful);
      console.log('  Failed:', response.data.summary.failed);
      
      if (response.data.errors && response.data.errors.length > 0) {
        console.log('\nErrors:');
        response.data.errors.forEach(err => {
          console.log(`  - Form ${err.index}: ${err.error}`);
        });
      }
    }
  } catch (error) {
    log('✗ Batch extraction failed', 'red');
    console.error('  Error:', error.response?.data?.error || error.message);
  }
}

async function testSampleForms() {
  logTest('Get Sample Forms');
  
  try {
    const response = await axios.get(`${API_ENDPOINT}/samples`);
    
    if (response.data.success) {
      log('✓ Sample forms retrieved', 'green');
      console.log('  Available samples:', response.data.data.length);
      
      response.data.data.forEach((sample, index) => {
        console.log(`  ${index + 1}. ${sample.title}`);
        console.log(`     ${sample.description}`);
      });
    }
  } catch (error) {
    log('✗ Failed to get sample forms', 'red');
    console.error('  Error:', error.response?.data?.error || error.message);
  }
}

async function checkServerConnection() {
  try {
    const response = await axios.get(BASE_URL);
    log('✓ Server is running', 'green');
    return true;
  } catch (error) {
    log('✗ Server is not running', 'red');
    console.error(`  Please start the server first: npm run dev`);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.clear();
  log('Google Forms Extraction Test Suite', 'cyan');
  log('==================================', 'cyan');
  
  // Check server connection
  log('\nChecking server connection...', 'yellow');
  const serverRunning = await checkServerConnection();
  
  if (!serverRunning) {
    log('\nTests aborted. Please start the server and try again.', 'red');
    process.exit(1);
  }
  
  // Run individual tests
  logSection('1. URL Validation Tests');
  for (const testForm of TEST_FORMS) {
    logTest(testForm.name);
    await testValidateUrl(testForm.url);
  }
  
  logSection('2. Form Extraction Tests');
  // Note: These won't work with example URLs, but will work with real Google Form URLs
  log('\nNote: Extraction tests require real Google Form URLs to work properly.', 'yellow');
  log('The example URLs will fail, but the functionality is ready for real forms.', 'yellow');
  
  for (const testForm of TEST_FORMS.slice(0, 1)) {
    logTest(testForm.name);
    await testExtractQuestions(testForm.url);
  }
  
  logSection('3. Additional Endpoint Tests');
  await testSampleForms();
  await testBatchExtraction();
  
  // Summary
  logSection('Test Summary');
  log('All tests completed!', 'green');
  log('\nTo test with real Google Forms:', 'yellow');
  log('1. Replace the example URLs in TEST_FORMS with actual Google Form URLs', 'yellow');
  log('2. Run the tests again: node test_google_forms.js', 'yellow');
  log('\nAPI Endpoints available:', 'cyan');
  log('  POST /api/google-forms/extract - Extract questions from a form', 'blue');
  log('  POST /api/google-forms/validate - Validate a Google Form URL', 'blue');
  log('  POST /api/google-forms/extract-and-save - Extract and save to event', 'blue');
  log('  POST /api/google-forms/extract-batch - Extract from multiple forms', 'blue');
  log('  GET  /api/google-forms/samples - Get sample form URLs', 'blue');
}

// Run the tests
runTests().catch(error => {
  log('\nUnexpected error during tests:', 'red');
  console.error(error);
  process.exit(1);
});