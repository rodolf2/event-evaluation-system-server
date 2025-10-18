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
        // First, get the email from Google profile
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
            user.avatar = profile.photos[0].value;
          }
          await user.save();
          return done(null, user);
        }

        // Determine user role based on email domain (flexible for development)
        const userEmail = profile.emails[0].value;
        let userRole = User.getUserTypeFromEmail(userEmail);

        // For development: allow any email with 'admin' for testing
        const isProduction = process.env.NODE_ENV === "production";
        if (!isProduction && userEmail.includes("admin")) {
          userRole = "admin";
        }

        // Create new user
        const newUser = new User({
          name: profile.displayName,
          email: userEmail,
          googleId: profile.id,
          role: userRole,
          avatar: profile.photos ? profile.photos[0].value : null,
        });

        user = await newUser.save();
        done(null, user);
      } catch (error) {
        done(error, null);
      }
    }
  )
);

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
