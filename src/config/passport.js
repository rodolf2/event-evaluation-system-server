const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
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
