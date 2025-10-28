require("dotenv").config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const cookieParser = require("cookie-parser");
const path = require("path");
const connectDB = require("./utils/db");
const User = require("./models/User");
require("./config/passport");

const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Configure Passport
require('./config/passport');

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Static file serving for certificate downloads and admin interface
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/uploads/csv", express.static(path.join(__dirname, "../uploads/csv")));
app.use(express.static(path.join(__dirname, "public")));

// Connect to Database
connectDB();

// Environment variable validation
const requiredEnvVars = ['JWT_SECRET', 'SESSION_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

// Simple route for testing
app.get("/", (req, res) => {
  res.send("Event Evaluation System API is running...");
});

// API Routes
const analysisRoutes = require('./api/routes/analysisRoutes');
const eventRoutes = require('./api/routes/eventRoutes');
const certificateRoutes = require('./api/routes/certificateRoutes');
const formsRoutes = require('./api/routes/formsRoutes');
const authRoutes = require('./api/routes/authRoutes');
const protectedRoutes = require('./api/routes/protectedRoutes');
const userRoutes = require('./api/routes/userRoutes');
const reminderRoutes = require('./api/routes/reminderRoutes');
const uploadRoutes = require('./api/routes/uploadRoutes');

app.use('/api/analysis', analysisRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/forms', formsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/protected', protectedRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/upload', uploadRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
