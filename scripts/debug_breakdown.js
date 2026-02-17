
const DynamicCSVReportService = require('../src/services/reports/dynamicCSVReportService');

// Mock Data
const attendeeList = [
  { email: "student1@test.com", Department: "Higher Education", Program: "BSA" },
  { email: "student2@test.com", Department: "Basic Education", Program: "Grade 12" },
  { email: "student3@test.com", Department: "Higher Education", Program: "BS IS" }
];

const responses = [
  { respondentEmail: "Student1@test.com" }, // Case diff
  { respondentEmail: "student3@test.com" }
];

console.log("--- Debugging DynamicCSVReportService.generateColumnBreakdown ---");

// Test Department
console.log("\nTesting 'Department' breakdown:");
const deptBreakdown = DynamicCSVReportService.generateColumnBreakdown(attendeeList, "Department", responses);
console.log(JSON.stringify(deptBreakdown, null, 2));

// Test Program
console.log("\nTesting 'Program' breakdown:");
const progBreakdown = DynamicCSVReportService.generateColumnBreakdown(attendeeList, "Program", responses);
console.log(JSON.stringify(progBreakdown, null, 2));

// Verify matching logic directly
console.log("\n--- Manual Verification ---");
const respondedEmails = new Set(responses.map(r => r.respondentEmail?.toLowerCase()));
console.log("Responded Emails Set:", Array.from(respondedEmails));

attendeeList.forEach(a => {
  const email = a.email?.toLowerCase();
  const matched = respondedEmails.has(email);
  console.log(`Attendee ${a.email} (${email}) matched? ${matched}`);
});
