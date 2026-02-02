
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

// MOCK FUNCTION from reportController.js
function processYearLevelBreakdown(form, responses) {
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  const normalizeYearLevel = (yearLevel, department) => {
    if (!yearLevel) return null;
    const normalized = yearLevel.toString().toLowerCase().trim();

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
      // --- LOGIC UNDER TEST ---
      let department = attendee.department;
      const rawYear = attendee.yearLevel || "";

      // Infer or Correct department based on year level
      const isDefaultOrMissing = !department || department === "Higher Education";
      if (isDefaultOrMissing && rawYear) {
        const lowerYear = rawYear.toString().toLowerCase();
        if (lowerYear.includes("grade") || lowerYear.includes("kinder") || lowerYear.includes("nursery") || (!isNaN(lowerYear) && parseInt(lowerYear) > 4)) {
          department = "Basic Education";
        }
      }
      department = department || "Higher Education";
      // ------------------------

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
      counts: data.currentYear.counts
    }))
  };
}

const verify = async () => {
    console.log("--- MOCK TEST START ---");
    
    // Scenerio: User uploaded Mixed Data (Grade 11 + 3rd Year)
    // Expectation: Should detect BOTH Basic Education AND Higher Education
    const mockForm = {
        attendeeList: [
            { email: "student1@test.com", yearLevel: "Grade 11", department: "Higher Education" }, // BAD DATA -> Should fix to Basic Ed
            { email: "student2@test.com", yearLevel: "3rd Year", department: "Higher Education" }  // GOOD DATA -> Should stay Higher Ed
        ]
    };

    const mockResponses = [
        { respondentEmail: "student1@test.com" },
        { respondentEmail: "student2@test.com" }
    ];

    const result = processYearLevelBreakdown(mockForm, mockResponses);
    
    console.log("Result Departments:", result.departments.map(d => d.name));
    result.departments.forEach(d => {
        console.log(`Department: ${d.name}`, d.counts);
    });

    if (result.departments.find(d => d.name === "Basic Education")) {
        console.log("SUCCESS: 'Basic Education' detected despite bad DB data!");
    } else {
        console.log("FAILURE: 'Basic Education' not detected.");
    }
};

verify();
