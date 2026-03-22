const mongoose = require("mongoose");
const dotenv = require("dotenv");
const dns = require("dns");

dns.setDefaultResultOrder("ipv4first");
dotenv.config();

const User = require("../src/models/User");

async function promoteBack() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);

    const email = "rodolfojrxgt@gmail.com";
    const user = await User.findOne({ email });

    if (!user) {
      console.log("User not found!");
      process.exit(1);
    }

    console.log(`Promoting ${user.name} back to MIS Head...`);

    user.role = "mis";
    user.position = "MIS Head";
    user.permissions.set("canViewReports", true);
    user.permissions.set("manage_roles_provisioning", true);
    user.permissions.set("access_system_configuration", true);

    await user.save();

    console.log("Success! You are now the MIS Head again.");
    console.log("Please log out and log back in to see the changes.");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

promoteBack();
