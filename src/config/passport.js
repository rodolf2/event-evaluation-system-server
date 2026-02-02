const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");
const SystemSettings = require("../models/SystemSettings");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Get the email from Google profile
        const googleEmail = profile.emails[0].value;

        // Validate email domain - only allow specific domains
        // Fetch dynamic allowed domains from System Settings
        const settings = await SystemSettings.getSettings();
        const dynamicWhitelist =
          settings.securitySettings?.domainWhitelist || [];

        // Combine defaults with dynamic whitelist
        const defaultDomains = ["@student.laverdad.edu.ph", "@laverdad.edu.ph"];

        const allowedDomains = [
          ...defaultDomains,
          ...dynamicWhitelist.map((d) =>
            d.domain.startsWith("@") ? d.domain : `@${d.domain}`,
          ),
        ];

        const isAllowedDomain = allowedDomains.some((domain) =>
          googleEmail.toLowerCase().endsWith(domain.toLowerCase()),
        );

        // HARDCODED ADMIN CHECK
        const HARDCODED_ADMIN_EMAILS = (process.env.SYSTEM_ADMIN_EMAIL || "")
          .split(",")
          .map((e) => e.trim())
          .filter((e) => e);
          
        const isHardcodedAdmin = HARDCODED_ADMIN_EMAILS.includes(googleEmail);

        if (!isAllowedDomain && !isHardcodedAdmin) {
          return done(null, false, {
            message: "Access denied. Use your school account.",
          });
        }

        // Check if user exists with the Google ID
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          // Verify that the stored email matches the Google email
          if (user.email !== googleEmail) {
            return done(null, false, {
              message: "Email mismatch. Please contact administrator.",
            });
          }
          // Update profile picture and name if available
          if (profile.photos && profile.photos[0]) {
            user.profilePicture = profile.photos[0].value;
            user.avatar = profile.photos[0].value; // Save as backup
          }
          if (profile.displayName) {
            user.name = profile.displayName;
          }

          // Force update for hardcoded admin
          if (isHardcodedAdmin) {
            console.log(`🚀 Admin login detected: Promoting ${googleEmail} to MIS Head`);
            user.role = "mis";
            user.position = "MIS Head";
            user.permissions = {
              canViewReports: true,
              canViewAnalytics: true,
              manage_users: true,
              manage_roles_provisioning: true,
              access_system_configuration: true,
              view_audit_logs: true
            };
            // Ensure permissions Map is also updated if using Map structure in model
            if (user.permissions instanceof Map) {
              user.permissions.set("canViewReports", true);
              user.permissions.set("manage_roles_provisioning", true);
              user.permissions.set("access_system_configuration", true);
              user.permissions.set("manage_users", true);
              user.permissions.set("view_audit_logs", true);
            }
          }

          await user.save();
          return done(null, user);
        }

        // Check if user exists with same email
        user = await User.findOne({ email: googleEmail });

        if (user) {
          // Verify the email still matches
          if (user.email !== googleEmail) {
            return done(null, false, {
              message: "Email mismatch. Please contact administrator.",
            });
          }
          // Link Google account to existing user
          user.googleId = profile.id;
          if (profile.photos && profile.photos[0]) {
            user.profilePicture = profile.photos[0].value;
            user.avatar = profile.photos[0].value; // Save as backup
          }
          if (profile.displayName) {
            user.name = profile.displayName;
          }

          // Force update for hardcoded admin
          if (isHardcodedAdmin) {
            console.log(`🚀 Admin login detected: Promoting ${googleEmail} to MIS Head`);
            user.role = "mis";
            user.position = "MIS Head";
            // Set basic MIS permissions
             user.permissions = {
              canViewReports: true,
              canViewAnalytics: true,
              manage_users: true,
              manage_roles_provisioning: true,
              access_system_configuration: true,
              view_audit_logs: true
            };
             if (user.permissions instanceof Map) {
              user.permissions.set("canViewReports", true);
              user.permissions.set("manage_roles_provisioning", true);
              user.permissions.set("access_system_configuration", true);
              user.permissions.set("manage_users", true);
              user.permissions.set("view_audit_logs", true);
            }
          }

          await user.save();
          return done(null, user);
        }

        // User not found in the system - reject login
        // UNLESS it's the hardcoded admin
        if (isHardcodedAdmin) {
           console.log(`🚀 Admin login detected: Creating new MIS Head account for ${googleEmail}`);
           user = new User({
             email: googleEmail,
             googleId: profile.id,
             name: profile.displayName || "Admin User",
             profilePicture: profile.photos && profile.photos[0] ? profile.photos[0].value : "",
             role: "mis",
             position: "MIS Head",
             department: "MIS",
             isActive: true, // Auto-activate
             permissions: {
                canViewReports: true,
                canViewAnalytics: true,
                manage_users: true,
                manage_roles_provisioning: true,
                access_system_configuration: true,
                view_audit_logs: true
             }
           });
           await user.save();
           return done(null, user);
        }

        // Only pre-registered users can log in
        return done(null, false, {
          message:
            "Access denied. Your account is not registered in the system. Please contact an administrator to request access.",
        });
      } catch (error) {
        return done(error, null);
      }
    },
  ),
);
// Serialize user into the session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
