<<<<<<< HEAD
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");
=======
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
>>>>>>> 28c2a0829cabd02254f53bf8130711435d5404e4

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
<<<<<<< HEAD
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
=======
      callbackURL: '/api/auth/google/callback',
      proxy: true
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        
        // Check if user already exists by googleId
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          // Validate that the email matches
          if (user.email !== email) {
            return done(null, false, { message: 'Email mismatch. Please use the email associated with your account.' });
          }
          
          // Update profile picture if available
          if (profile.photos && profile.photos.length > 0) {
            user.profilePicture = profile.photos[0].value;
            await user.save();
          }
          
          return done(null, user);
        }
        
        // Check if email is already registered with a different account
        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
          return done(null, false, { message: 'Email already registered with a different account.' });
        }

        // Create new user if doesn't exist
        user = new User({
          googleId: profile.id,
          name: profile.displayName,
          email: email,
          profilePicture: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null,
          role: 'participant' // Default role
        });

        await user.save();
        return done(null, user);
      } catch (error) {
        return done(error, null);
>>>>>>> 28c2a0829cabd02254f53bf8130711435d5404e4
      }
    }
  )
);

<<<<<<< HEAD
// Serialize user for session
=======
// Serialize user into the session
>>>>>>> 28c2a0829cabd02254f53bf8130711435d5404e4
passport.serializeUser((user, done) => {
  done(null, user.id);
});

<<<<<<< HEAD
// Deserialize user from session
=======
// Deserialize user from the session
>>>>>>> 28c2a0829cabd02254f53bf8130711435d5404e4
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

<<<<<<< HEAD
module.exports = passport;
=======
module.exports = passport;
>>>>>>> 28c2a0829cabd02254f53bf8130711435d5404e4
