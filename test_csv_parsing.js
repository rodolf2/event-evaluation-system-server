
const FormsService = require('./src/services/forms/formsService');
const path = require('path');

async function testCsvParsing() {
  try {
    const filePath = path.join(__dirname, '../students.csv');
    console.log(`Testing CSV parsing for file: ${filePath}`);
    const attendees = await FormsService.parseAttendeeFile(filePath);
    console.log('Parsed attendees:', attendees);
  } catch (error) {
    console.error('Error during CSV parsing test:', error);
  }
}

testCsvParsing();
