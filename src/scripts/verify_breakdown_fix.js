
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const User = require("../models/User");
const Form = require("../models/Form");

// MOCK FUNCTION from reportController.js
function processYearLevelBreakdown(form, responses, previousForm = null, previousResponses = []) {
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  // Helper to normalize year level values
  const normalizeYearLevel = (yearLevel, department) => {
    if (!yearLevel) return null;
    const normalized = yearLevel.toString().toLowerCase().trim();

    // Handle Higher Education / College
    if (
      !department ||
      department.toLowerCase().includes("higher") ||
      department.toLowerCase().includes("college")
    ) {
      if (normalized.includes("1st year") || normalized === "1") return "1st Year";
      if (normalized.includes("2nd year") || normalized === "2") return "2nd Year";
      if (normalized.includes("3rd year") || normalized === "3") return "3rd Year";
      if (normalized.includes("4th year") || normalized === "4") return "4th Year";
    }

    // Handle Basic Education
    if (
      department &&
      (department.toLowerCase().includes("basic") ||
        department.toLowerCase().includes("education"))
    ) {
      if (normalized.startsWith("grade")) {
         const parts = normalized.split(" ");
         if (parts.length > 1) return "Grade " + parts[1];
      }
      if (!isNaN(normalized)) return `Grade ${normalized}`;
    }

    return yearLevel.toString().trim();
  };

  const attendeeMetadata = {};
  const attendeeList = form.attendeeList || [];
  const detectedDepartments = new Set();

  attendeeList.forEach((attendee) => {
    if (attendee.email) {
      const department = attendee.department || "Higher Education";
      const normalizedLevel = normalizeYearLevel(attendee.yearLevel, department);

      if (normalizedLevel) {
        attendeeMetadata[attendee.email.toLowerCase()] = {
          yearLevel: normalizedLevel,
          department: department,
        };
        detectedDepartments.add(department);
      }
    }
  });

  if (detectedDepartments.size === 0) detectedDepartments.add("Higher Education");

  const departmentData = {};
  detectedDepartments.forEach((dept) => {
    departmentData[dept] = {
      currentYear: { year: currentYear, counts: {}, total: 0 },
      previousYear: { year: previousYear, counts: {}, total: 0 },
    };
  });

  responses.forEach((response) => {
    const email = response.respondentEmail?.toLowerCase();
    const meta = attendeeMetadata[email];
    if (!meta) return;

    const { yearLevel, department } = meta;
    departmentData[department].currentYear.counts[yearLevel] =
      (departmentData[department].currentYear.counts[yearLevel] || 0) + 1;
    departmentData[department].currentYear.total++;
  });

  return {
    departments: Object.entries(departmentData).map(([deptName, data]) => ({
      name: deptName,
      currentYear: data.currentYear
    }))
  };
}

const verify = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB Connected");

    const targetName = "Rodolfo Ebajan Jr.";
    
    // 1. Find the user to get their ID
    const user = await User.findOne({ name: targetName });
    if (!user) {
        console.log("Target user not found, cannot verify.");
        return;
    }
    console.log(`Target User: ${user.email}, Dept: ${user.department}, Year: ${user.yearLevel}`);

    // 2. Find a form where this user responded
    const forms = await Form.find({ "responses.respondentEmail": user.email }).sort({ updatedAt: -1 }).limit(1);
    
    if (forms.length === 0) {
        console.log("No form responses found for user.");
        return;
    }
    
    const form = forms[0];
    console.log(`Using Form: "${form.title}"`);

    // 3. Simulate Logic WITHOUT Fix
    console.log("\n--- WITHOUT FIX ---");
    const originalResult = processYearLevelBreakdown(form, form.responses);
    console.log("Departments detected:", originalResult.departments.map(d => d.name));
    console.log("Counts:", JSON.stringify(originalResult.departments, null, 2));

    // 4. Simulate Logic WITH Fix
    console.log("\n--- WITH FIX ---");
    
    const existingEmails = new Set((form.attendeeList || []).map(a => a.email?.toLowerCase()).filter(Boolean));
    const missingEmails = form.responses
        .map(r => r.respondentEmail?.toLowerCase())
        .filter(email => email && !existingEmails.has(email));
      
    if (missingEmails.length > 0) {
        const foundUsers = await User.find({ email: { $in: missingEmails } });
        const extraAttendees = foundUsers.map(u => ({
            email: u.email,
            department: u.department,
            yearLevel: u.yearLevel,
            name: u.name,
            role: u.role
        }));
        
        const plainForm = form.toObject();
        plainForm.attendeeList = [...(plainForm.attendeeList || []), ...extraAttendees];
        
        const fixedResult = processYearLevelBreakdown(plainForm, form.responses);
        console.log("Departments detected:", fixedResult.departments.map(d => d.name));
        console.log("Counts:", JSON.stringify(fixedResult.departments, null, 2));
    } else {
        console.log("No missing emails found (user might already be in attendee list?)");
    }

  } catch (err) {
    console.error("Verification failed:", err);
  } finally {
    mongoose.connection.close();
  }
};

verify();
