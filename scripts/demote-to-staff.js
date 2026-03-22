const mongoose = require("mongoose");
const dotenv = require("dotenv");
const dns = require("dns");

dns.setDefaultResultOrder("ipv4first");
dotenv.config();

const User = require("../src/models/User");

// Get email from command line arg or use default
const targetEmail = process.argv[2] || "rodolfojrxgt@gmail.com";

async function demoteToStaff() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);

    const user = await User.findOne({ email: targetEmail });

    if (!user) {
      console.log(`User ${targetEmail} not found!`);
      process.exit(1);
    }

    console.log(
      `Demoting ${user.name} (${user.email}) from MIS Head to MIS Staff...`,
    );

    // Set to regular MIS permissions/position
    user.role = "mis";
    user.position = "MIS Staff";

    // Adjust permissions as per "regular" staff needs (based on our UserManagement.jsx defaults)
    // usually regular staff might still view reports/analytics depending on implementation,
    // but we specifically check position="MIS Head" for user management.
    // We'll reset permissions to some sensible default for a staff member.
    user.permissions.set("manage_roles_provisioning", false);
    user.permissions.set("access_system_configuration", false);
    user.permissions.set("canViewReports", true); // Assuming staff can still view reports? Or maybe not.
    // Based on previous code, MIS staff (regular) generally had:
    // view_audit_logs: true, manage_roles_provisioning: true (previously), etc.
    // But now we want to RESTRICT provisioning.

    await user.save();

    console.log("Success! You are now a regular MIS Staff.");
    console.log("You should NOT be able to add/provision users.");
    console.log("Please log out and log back in to see the changes.");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

demoteToStaff();
