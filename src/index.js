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

// Configure Passport
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
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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

// Static file serving
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use(express.static(path.join(__dirname, "../public")));

// Connect to Database
connectDB();

// Environment variable validation
const requiredEnvVars = ["JWT_SECRET", "SESSION_SECRET"];
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(
    "❌ Missing required environment variables:",
    missingEnvVars.join(", ")
  );
  process.exit(1);
}

// Simple route for testing
app.get("/", (req, res) => {
  res.send("Event Evaluation System API is running...");
});

// Development testing route
if (process.env.NODE_ENV === "development") {
  app.get("/dev-login/:email", async (req, res) => {
    try {
      const { email } = req.params;
      let user = await User.findOne({ email });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found. Create user first via bootstrap.",
        });
      }

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
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
const notificationRoutes = require("./api/routes/notificationRoutes");
const activityRoutes = require("./api/routes/activityRoutes");
const eventRoutes = require("./api/routes/eventRoutes");
const formsRoutes = require("./api/routes/formsRoutes");
const uploadRoutes = require("./api/routes/uploadRoutes");
const analyticsRoutes = require("./api/routes/analyticsRoutes");
const reportsRoutes = require("./api/routes/reports");

app.use("/api/analysis", analysisRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/bootstrap", bootstrapRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/forms", formsRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/thumbnails", require("./api/routes/thumbnailRoutes"));

// Test routes for development
if (process.env.NODE_ENV === "development") {
  const userTestRoutes = require("./api/routes/userTestRoutes");
  app.use("/api/test/users", userTestRoutes);
  console.log("🧪 Test routes enabled for development");
  console.log("🔍 Certificate template debugging enabled");
}

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error("❌ Unhandled error:", error);

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation Error",
      error: error.message,
    });
  }

  if (error.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }

  if (error.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token expired",
    });
  }

  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  });
});

// 404 handler
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

// In your server/src/index.js or wherever CORS is configured
const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
};
app.use(cors(corsOptions));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
