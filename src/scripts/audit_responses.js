
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const User = require("../models/User");
const Form = require("../models/Form");

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB Connected");
  } catch (err) {
    console.error("MongoDB Connection Error:", err);
    process.exit(1);
  }
};

const audit = async () => {
  try {
    const targetName = "Rodolfo Ebajan Jr.";
    console.log(`Searching for user: ${targetName}...`);
    
    // 1. Find the user
    const user = await User.findOne({ name: targetName });
    if (!user) {
      console.log("User NOT found in 'users' collection.");
    } else {
      console.log("User found:", {
        id: user._id,
        email: user.email,
        department: user.department,
        yearLevel: user.yearLevel,
        role: user.role
      });
    }

    // 2. Find recent responses from Forms
    console.log("\nChecking forms for responses...");
    // Find forms that have responses
    const forms = await Form.find({ "responses.0": { $exists: true } }).sort({ updatedAt: -1 }).limit(5);
    
    if (forms.length === 0) {
      console.log("No forms with responses found.");
    }

    for (const form of forms) {
      console.log(`\nChecking Form: "${form.title}" (${form._id})`);
      
      // Filter responses for target user (case-insensitive email check)
      const userResponses = form.responses.filter(r => 
        r.respondentName === targetName || 
        (user && r.respondentEmail && r.respondentEmail.toLowerCase() === user.email.toLowerCase())
      );

      if (userResponses.length > 0) {
        console.log(`  Found ${userResponses.length} response(s) from target user!`);
        
        userResponses.forEach(r => {
           console.log(`  Response ID: ${r._id}`);
           console.log(`  Submitted At: ${r.submittedAt}`);
           console.log(`  Email in Response: ${r.respondentEmail}`);

           // Check attendee list for this user
           const attendee = form.attendeeList.find(a => 
             (a.email && a.email.toLowerCase() === r.respondentEmail.toLowerCase()) || 
             a.name === r.respondentName
           );

           if (attendee) {
             console.log("  User matches Attendee List entry:");
             console.log("    Department:", attendee.department);
             console.log("    Year Level:", attendee.yearLevel);
           } else {
             console.log("  WARNING: User NOT found in Attendee List for this form!");
           }
        });
      } else {
        console.log("  No responses from target user in this form.");
      }
    }

  } catch (err) {
    console.error("Audit failed:", err);
  } finally {
    mongoose.connection.close();
  }
};

connectDB().then(audit);
