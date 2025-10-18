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
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Development testing route (bypass Google OAuth for testing) - ONLY in development
if (process.env.NODE_ENV === "development") {
app.get("/dev-login/:email", async (req, res) => {
  try {
    const email = req.params.email;

    // Check if user exists
    let user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found. Create user first via bootstrap.",
      });
    }

    // Generate development token (bypass Google OAuth)
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      success: true,
      message: "Development login successful",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Development login failed",
      error: error.message,
    });
  }
});
}

// API Routes
const analysisRoutes = require("./api/routes/analysisRoutes");
const certificateRoutes = require("./api/routes/certificateRoutes");
const authRoutes = require("./api/routes/authRoutes");
const userRoutes = require("./api/routes/userRoutes");
const bootstrapRoutes = require("./api/routes/bootstrapRoutes");
const reminderRoutes = require("./api/routes/reminderRoutes");

// Debug: Log all API routes
console.log("🔗 API Routes loaded:");
console.log("  - /api/analysis");
console.log("  - /api/certificates");
console.log("  - /api/auth");
console.log("  - /api/users");
console.log("  - /api/reminders");
console.log("  - /api/test/users (development only)");
console.log("  - /api/bootstrap");

app.use("/api/analysis", analysisRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/reminders", reminderRoutes);

// Test routes for development (no authentication required)
if (process.env.NODE_ENV === "development") {
  const userTestRoutes = require("./api/routes/userTestRoutes");
  app.use("/api/test/users", userTestRoutes);
  console.log("🧪 Test routes enabled for development");
}

app.use("/api/bootstrap", bootstrapRoutes);

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);

  // Mongoose validation error
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      error: error.message,
    });
  }

  // JWT error
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
    });
  }

  // JWT expired error
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired',
    });
  }

  // Default error
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
});

// 404 handler - must be last
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
