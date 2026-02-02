const mongoose = require("mongoose");
const dotenv = require("dotenv");
const dns = require("dns");

// Force IPv4 for DNS resolution to avoid connection issues
dns.setDefaultResultOrder("ipv4first");

dotenv.config();

const User = require("./src/models/User");

async function makePsas() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected successfully.");

    const email = "rodolfojrxgt@gmail.com";
    
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log("User not found!");
      process.exit(1);
    }

    console.log(`Updating user: ${user.name} (${user.email})`);
    
    // Update role and clear MIS-specific fields
    user.role = "psas";
    user.position = "PSAS Staff"; // Or null, but PSAS might benefit from a position
    
    // Clear MIS specific permissions if any
    if (user.permissions) {
      user.permissions.delete("canViewReports");
      user.permissions.delete("manage_roles_provisioning");
      user.permissions.delete("access_system_configuration");
    }

    await user.save();
    
    console.log("User updated successfully to PSAS role!");
    console.log("New User Info:", {
        name: user.name,
        email: user.email,
        role: user.role,
        position: user.position,
        permissions: Object.fromEntries(user.permissions || [])
    });

  } catch (error) {
    console.error("Error updating user:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

makePsas();
