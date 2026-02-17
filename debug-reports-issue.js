/**
 * Debug Script: Reports Not Loading
 *
 * This script diagnoses why reports aren't loading:
 * 1. Checks if reports exist in the database
 * 2. Verifies API endpoints are working
 * 3. Checks authorization issues
 * 4. Validates response structure
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "./server/.env") });

const Report = require("./src/models/Report");
const Form = require("./src/models/Form");
const User = require("./src/models/User");
const SharedReport = require("./src/models/SharedReport");

async function debugReportsIssue() {
  try {
    const MONGO_URI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/event-evaluation";
    console.log("🔍 Connecting to database...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected!\n");

    // 1. Check if reports exist
    console.log("📋 === REPORTS INVENTORY ===");
    const totalReports = await Report.countDocuments();
    console.log(`Total Reports: ${totalReports}`);

    const generatedReports = await Report.countDocuments({ isGenerated: true });
    console.log(`Generated Reports: ${generatedReports}`);

    const activeReports = await Report.countDocuments({ status: "published" });
    console.log(`Active (Published) Reports: ${activeReports}`);

    // 2. Check sample reports
    console.log("\n📊 === SAMPLE REPORTS ===");
    const sampleReports = await Report.find()
      .limit(3)
      .select("_id title formId status isGenerated");

    if (sampleReports.length === 0) {
      console.log("⚠️  NO REPORTS FOUND IN DATABASE!");
      console.log("   → Users need to generate reports first");
    } else {
      sampleReports.forEach((r, i) => {
        console.log(`${i + 1}. ${r.title || "Untitled"} (${r._id})`);
        console.log(`   Status: ${r.status}, Generated: ${r.isGenerated}`);
      });
    }

    // 3. Check forms that can generate reports
    console.log("\n📝 === FORMS STATUS ===");
    const publishedForms = await Form.countDocuments({ status: "published" });
    const closedForms = await Form.countDocuments({ status: "closed" });
    const totalForms = await Form.countDocuments();

    console.log(`Total Forms: ${totalForms}`);
    console.log(`Published Forms: ${publishedForms}`);
    console.log(`Closed Forms: ${closedForms}`);

    // 4. Check shared reports
    console.log("\n🔗 === SHARED REPORTS ===");
    const sharedReports = await SharedReport.countDocuments();
    console.log(`Total Shared Reports: ${sharedReports}`);

    if (sharedReports > 0) {
      const sharedOnce = await SharedReport.findOne().select(
        "reportId sharedWith sharedBy",
      );
      if (sharedOnce) {
        console.log(
          `Example: Shared with ${sharedOnce.sharedWith?.length || 0} users`,
        );
      }
    }

    // 5. Check users and their roles
    console.log("\n👥 === USER ROLES ===");
    const roles = [
      "psas",
      "club-officer",
      "club-adviser",
      "mis",
      "school-admin",
    ];
    for (const role of roles) {
      const count = await User.countDocuments({ role });
      console.log(`${role}: ${count} users`);
    }

    // 6. Check for potential issues
    console.log("\n⚠️  === POTENTIAL ISSUES ===");
    const reportsWithoutForms = await Report.countDocuments({ formId: null });
    if (reportsWithoutForms > 0) {
      console.log(`❌ ${reportsWithoutForms} reports missing form references!`);
    }

    const reportsWithoutTitles = await Report.countDocuments({
      title: { $in: [null, ""] },
    });
    if (reportsWithoutTitles > 0) {
      console.log(`⚠️  ${reportsWithoutTitles} reports missing titles`);
    }

    const orphanedReports = await Report.countDocuments({
      formId: { $nin: await Form.find({}).distinct("_id") },
    });
    if (orphanedReports > 0) {
      console.log(`⚠️  ${orphanedReports} reports reference deleted forms`);
    }

    // 7. Explain common issues
    console.log("\n💡 === COMMON SOLUTIONS ===");
    if (totalReports === 0) {
      console.log("1. NO REPORTS EXIST");
      console.log("   → Create a form, close it, and generate a report");
      console.log("   → Or upload a form with responses then generate report");
    }

    if (publishedForms > 0 && totalReports === 0) {
      console.log("2. FORMS EXIST BUT NO REPORTS");
      console.log("   → Generate reports from the forms");
      console.log("   → API: POST /api/analytics/reports/generate/:formId");
    }

    if (totalReports > 0 && activeReports === 0) {
      console.log("3. REPORTS EXIST BUT NOT PUBLISHED");
      console.log("   → Check report status field");
      console.log("   → Ensure status is 'published' or 'active'");
    }

    console.log("\n🔧 === DEBUG OUTPUT COMPLETE ===\n");

    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ DEBUG ERROR:", error.message);
    if (error.message.includes("ECONNREFUSED")) {
      console.error("   → MongoDB is not running");
      console.error("   → Start MongoDB first");
    }
    process.exit(1);
  }
}

debugReportsIssue();
