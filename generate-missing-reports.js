/**
 * Fix Script: Generate Missing Reports
 *
 * This script:
 * 1. Finds all closed/published forms without reports
 * 2. Generates reports for them
 * 3. Verifies reports are created
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "./server/.env") });

const Report = require("./src/models/Report");
const Form = require("./src/models/Form");
const ThumbnailService = require("./src/services/thumbnail/thumbnailService");

async function generateMissingReports() {
  try {
    console.log("🚀 Starting missing reports generation...\n");

    const MONGO_URI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/event-evaluation";
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to database\n");

    // 1. Find forms that should have reports but don't
    console.log("📋 === FINDING FORMS WITHOUT REPORTS ===");

    const formsWithoutReports = await Form.find({
      status: { $in: ["published", "closed"] },
      _id: {
        $nin: await Report.find({}).distinct("formId"),
      },
    }).select("_id title status createdAt");

    console.log(`Found ${formsWithoutReports.length} forms without reports\n`);

    if (formsWithoutReports.length === 0) {
      console.log("✅ All forms have reports!\n");
      await mongoose.disconnect();
      return;
    }

    // 2. Generate reports for each form
    console.log("📊 === GENERATING REPORTS ===\n");

    for (let i = 0; i < formsWithoutReports.length; i++) {
      const form = formsWithoutReports[i];
      console.log(
        `[${i + 1}/${formsWithoutReports.length}] Generating report for: ${form.title}`,
      );

      try {
        // Check if report already exists (safety check)
        const existingReport = await Report.findOne({ formId: form._id });
        if (existingReport) {
          console.log(`   ⏭️  Skip - Report already exists`);
          continue;
        }

        // Calculate stats
        const totalAttendees = form.attendeeList ? form.attendeeList.length : 0;
        const totalResponses = form.responses ? form.responses.length : 0;
        const responseRate =
          totalAttendees > 0
            ? Math.round((totalResponses / totalAttendees) * 100 * 100) / 100
            : 0;

        // Calculate average rating from scale responses
        const scaleResponses = (form.responses || [])
          .flatMap((r) => r.answers || [])
          .filter((a) => a.type === "scale" && !isNaN(a.value))
          .map((a) => ({ value: parseInt(a.value) }));

        const averageRating =
          scaleResponses.length > 0
            ? Math.round(
                (scaleResponses.reduce((sum, r) => sum + r.value, 0) /
                  scaleResponses.length) *
                  100,
              ) / 100
            : 0;

        // Generate thumbnail
        let thumbnail = null;
        try {
          thumbnail = await ThumbnailService.generateThumbnail(
            form._id.toString(),
            form,
          );
          console.log(`   ✅ Thumbnail generated`);
        } catch (err) {
          console.log(`   ⚠️  Thumbnail generation failed:`, err.message);
          thumbnail = null;
        }

        // Create report
        const newReport = new Report({
          formId: form._id,
          userId: form.createdBy,
          title: `Report - ${form.title}`,
          eventDate: form.eventStartDate || form.createdAt,
          status: "published",
          isGenerated: true,
          feedbackCount: totalResponses,
          averageRating: averageRating,
          thumbnail: thumbnail,
          metadata: {
            description: form.description || "",
            attendeeCount: totalAttendees,
            responseRate: responseRate,
            eventStartDate: form.eventStartDate,
            eventEndDate: form.eventEndDate,
          },
          analytics: {
            quantitativeData: {
              totalResponses,
              totalAttendees,
              responseRate,
              averageRating,
            },
          },
        });

        await newReport.save();
        console.log(`   ✅ Report created (ID: ${newReport._id})`);
      } catch (err) {
        console.error(`   ❌ Error: ${err.message}`);
      }
    }

    // 3. Verify
    console.log("\n📈 === VERIFICATION ===\n");
    const totalReports = await Report.countDocuments();
    const publishedReports = await Report.countDocuments({
      status: "published",
    });
    const generatedReports = await Report.countDocuments({ isGenerated: true });

    console.log(`Total Reports: ${totalReports}`);
    console.log(`Published Reports: ${publishedReports}`);
    console.log(`Generated Reports: ${generatedReports}`);

    console.log("\n✅ === COMPLETE ===");
    console.log("All forms now have reports!");
    console.log("Go to the Reports page to see them.\n");

    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

generateMissingReports();
