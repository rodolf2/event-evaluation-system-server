const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Get the email from Google profile
        const googleEmail = profile.emails[0].value;

        // Check if user exists with the Google ID
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          // Verify that the stored email matches the Google email
          if (user.email !== googleEmail) {
            return done(null, false, {
              message: "Email mismatch. Please contact administrator.",
            });
          }
          // Update profile picture if available
          if (profile.photos && profile.photos[0]) {
            user.profilePicture = profile.photos[0].value;
            user.avatar = profile.photos[0].value; // Save as backup
            await user.save();
          }
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
          await user.save();
          return done(null, user);
        }

        // Determine user role based on email domain
        const userEmail = profile.emails[0].value;
        let userRole = User.getUserTypeFromEmail(userEmail);

        // For development: allow any email with 'mis' for MIS role testing
        const isProduction = process.env.NODE_ENV === "production";
        if (!isProduction && userEmail.includes("mis")) {
          userRole = "mis";
        }

        // Create new user
        const newUser = new User({
          name: profile.displayName,
          email: userEmail,
          googleId: profile.id,
          role: userRole,
          profilePicture: profile.photos ? profile.photos[0].value : null,
          avatar: profile.photos ? profile.photos[0].value : null, // Save as backup
          // Extract country from Google profile locale if available
          country: profile._json?.locale?.includes("PH")
            ? "Philippines"
            : "Philippines", // Default to Philippines
        });

        user = await newUser.save();
        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
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
