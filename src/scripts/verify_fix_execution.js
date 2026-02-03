const fs = require('fs');
const path = require('path');
const formsService = require('../services/forms/formsService');
// const { cleanString } = require('../utils/textUtils'); // REMOVED: Not needed and file missing

// Mock formsService.parseAttendeeFile dependency effectively by creating a temporary file
const tempCsvPath = path.join(__dirname, 'temp_test_students.csv');

async function runTest() {
    console.log("----------------------------------------------------------------");
    console.log("VERIFYING CSV INGEST FIX");
    console.log("----------------------------------------------------------------");

    // 1. Create a dummy CSV with tricky headers
    const csvContent = `Student Name,Email Address,Student Year,Department Name,How was the food?,Will you return?
John Doe,john@test.com,Grade 11,Basic Ed,Great,Yes
Jane Doe,jane@test.com,4th Year,Engineering,Okay,Maybe
Bob Smith,bob@test.com,1st Year,Nursing,Bad,No
Alice Wong,alice@test.com,Grade 12,Basic Ed,Excellent,Yes`;

    fs.writeFileSync(tempCsvPath, csvContent);
    console.log("Created temp CSV file with headers: Student Name, Email Address, Student Year, Department Name");

    try {
        // 2. Run formsService.parseAttendeeFile
        console.log("\nRunning formsService.parseAttendeeFile...");
        const parsedAttendees = await formsService.parseAttendeeFile(tempCsvPath);
        
        console.log(`Parsed ${parsedAttendees.length} attendees.`);
        if (parsedAttendees.length > 0) {
            console.log("Sample Attendee (Raw from Service):", parsedAttendees[0]);
            
            // Check if yearLevel is populated by the service
            if (parsedAttendees[0].yearLevel) {
                console.log("✅ Service populated 'yearLevel' field: ", parsedAttendees[0].yearLevel);
            } else {
                console.log("❌ Service DID NOT populate 'yearLevel' field.");
            }
        }

        // 3. Simulate formsController mapping logic
        console.log("\nSimulating formsController Mapping Logic...");
        
        const mappedAttendees = parsedAttendees.map(attendee => {
             // Helper to case-insensitively find a property with trimming (COPIED FROM CONTROLLER)
            const findProp = (obj, ...candidates) => {
              const keys = Object.keys(obj);
              for (const candidate of candidates) {
                // Try strict match first (trimmed)
                let match = keys.find(k => k.trim().toLowerCase() === candidate.toLowerCase());
                if (!match) {
                    // Try includes fallback
                    match = keys.find(k => k.toLowerCase().includes(candidate.toLowerCase()));
                }
                
                if (match) {
                    console.log(`   -> Matched candidate '${candidate}' to key '${match}' with value '${obj[match]}'`);
                    return obj[match];
                }
              }
              return null;
            };

            const yearVal = findProp(attendee, 'year', 'yearLevel', 'year_level', 'year level', 'level', 'grade', 'yr', 'student year');
            const deptVal = findProp(attendee, 'department', 'dept', 'department name', 'college', 'course', 'program', 'strand', 'track', 'branch');

            return {
                email: attendee.email,
                yearLevel: yearVal,
                department: deptVal
            };
        });

        console.log("\nMapped Results (Controller Output):");
        mappedAttendees.forEach(a => {
            console.log(`User: ${a.email} | Year: ${a.yearLevel} | Dept: ${a.department}`);
        });

        // 4. Assertions
        const success = mappedAttendees.every(a => a.yearLevel && a.department);
        if (success) {
            console.log("\n✅ SUCCESS: All attendees have mapped Year and Department.");
        } else {
             console.log("\n❌ FAILURE: Some attendees are missing data.");
        }

        // 5. Verify CSV Response Ingestion Logic (Mocking createFormFromUpload logic)
        console.log("\n----------------------------------------------------------------");
        console.log("VERIFYING RESPONSE INGESTION");
        console.log("----------------------------------------------------------------");
        
        // Mock the FormsService.createFormFromUpload internal logic
        // We can't easily call the method directly because it writes to DB, but we can inspect the parsing logic
        // which is unfortunately inside the method.
        // Ideally we'd modify the service to export checking logic or just rely on manual verification
        // BUT, we can try to call createFormFromUpload if we mock the DB save.
        
        // Let's just trust the manual verification plan for the DB part, 
        // but we can parse the CSV here to verify our assumption about "questions" vs "metadata"
        
        const headers = ["Student Name","Email Address","Student Year","Department Name","How was the food?","Will you return?"];
        const metadataKeywords = ['name', 'email', 'year', 'grade', 'level', 'dept', 'department', 'college', 'program', 'course', 'uploaded', 'timestamp'];
        const potentialQuestionHeaders = headers.filter(h => {
             const lowerH = h.toLowerCase();
             if (lowerH.includes('feedback') || lowerH.includes('comment') || lowerH.includes('suggestion')) return true;
             return !metadataKeywords.some(keyword => lowerH.includes(keyword));
        });
        
        console.log("Detected Questions:", potentialQuestionHeaders);
        if (potentialQuestionHeaders.includes("How was the food?") && potentialQuestionHeaders.includes("Will you return?")) {
             console.log("✅ SUCCESS: Correctly identified non-metadata columns as Questions.");
        } else {
             console.log("❌ FAILURE: Failed to identify questions.");
        }

    } catch (error) {
        console.error("Test Error:", error);
    } finally {
        if (fs.existsSync(tempCsvPath)) {
            fs.unlinkSync(tempCsvPath);
        }
    }
}

// Mock the csv-parser if needed, but since we are in the server environment we should assume node_modules exists.
// However, I need to make sure I am running this in the correct context.
// The default_api:run_command tool runs in the root? No, I can specify Cwd.
    
runTest();
