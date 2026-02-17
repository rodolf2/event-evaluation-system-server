require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const User = require("../src/models/User");
const Form = require("../src/models/Form");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB Connected");
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1);
  }
};

const run = async () => {
  await connectDB();

  try {
    const targetEmail = "rodolfojrebajan@student.laverdad.edu.ph";
    console.log(`Searching for user with email: ${targetEmail}`);

    const user = await User.findOne({ email: targetEmail });
    if (!user) {
      console.log("User not found in User collection.");
    } else {
      console.log(`User found: ${user.name} (${user.email}) ID: ${user._id}`);
    }

    // Find forms where this email is in responses
    const formsWithResponse = await Form.find({
      "responses.respondentEmail": targetEmail
    });

    console.log(`\nFound ${formsWithResponse.length} forms with response from this email.`);

    for (const form of formsWithResponse) {
      console.log(`\n--------------------------------------------------`);
      console.log(`Form ID: ${form._id}`);
      console.log(`Title: ${form.title}`);
      
      // Find the specific response
      const response = form.responses.find(r => r.respondentEmail === targetEmail);
      console.log(`Response Found:`);
      console.log(`- Email: "${response.respondentEmail}"`);
      console.log(`- Name: "${response.respondentName}"`);
      console.log(`- SubmittedAt: ${response.submittedAt}`);

      // Check attendee list
      const attendee = form.attendeeList.find(a => a.email.toLowerCase() === targetEmail.toLowerCase());
      
      if (attendee) {
        console.log(`Attendee Found in List:`);
        console.log(`- Email: "${attendee.email}"`);
        console.log(`- Name: "${attendee.name}"`);
        console.log(`- HasResponded: ${attendee.hasResponded}`);
        console.log(`- UploadedAt: ${attendee.uploadedAt}`);
        console.log(`- Certificate Generated: ${attendee.certificateGenerated}`);
        console.log(`- Certificate ID: ${attendee.certificateId}`);
        
        // Check strict equality match
        const emailMatch = response.respondentEmail.toLowerCase() === attendee.email.toLowerCase();
        console.log(`\nEmail Match Check: ${emailMatch ? "MATCH" : "MISMATCH"}`);
        console.log(`Response Email (lower): "${response.respondentEmail.toLowerCase()}"`);
        console.log(`Attendee Email (lower): "${attendee.email.toLowerCase()}"`);
        
        // Strings comparison with char codes to detect hidden characters
        if (!emailMatch) {
            console.log("Detailed character comparison:");
            const rEmail = response.respondentEmail.toLowerCase();
            const aEmail = attendee.email.toLowerCase();
            for(let i=0; i<Math.max(rEmail.length, aEmail.length); i++) {
                console.log(`Are chars at ${i} same? ${rEmail[i]} vs ${aEmail[i]} : ${rEmail.charCodeAt(i)} vs ${aEmail.charCodeAt(i)}`);
            }
        }

      } else {
        console.log(`Attendee NOT found in original attendeeList.`);
        
        // This simulates the behavior in reportController.js where it might augment the list
        // BUT the report breakdown logic in DynamicCSVReportService relies on the list passed to it.
        // If the report controller augmented it, it should be there.
      }
    }

    // Also check if there are forms where he is an attendee but NO response is recorded
    // (This might be the case if the response email defines him differently?)
    
  } catch (error) {
    console.error("Error running script:", error);
  } finally {
    await mongoose.connection.close();
  }
};

run();
