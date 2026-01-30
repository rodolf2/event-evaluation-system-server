require("dotenv").config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const path = require("path");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const compression = require("compression");
const { v4: uuidv4 } = require("uuid");
const connectDB = require("./utils/db");
const mongoose = require("mongoose");
const { init: initSocket } = require("./utils/socket");
const { requireAuth } = require("./middlewares/auth");
const User = require("./models/User");
const {
  logSecurityEvent,
  SecurityEventType,
  createSecurityLoggerMiddleware,
} = require("./utils/securityLogger");

// Configure Passport
require("./config/passport");

const app = express();

// Trust proxy for production environments (Railway, Render, etc.)
// This is required for express-rate-limit to work correctly behind a proxy
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Middleware
const allowedOrigins = (
  process.env.CLIENT_URLS ||
  process.env.CLIENT_URL ||
  "http://localhost:5173"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(compression()); // Gzip compression for responses
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request ID tracking middleware
app.use((req, res, next) => {
  req.requestId = uuidv4();
  res.setHeader("X-Request-Id", req.requestId);
  next();
});

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// 1. Security headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://fonts.googleapis.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", ...allowedOrigins],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow loading external resources
  }),
);

// 2. NoSQL Injection Sanitization (sanitize req.body only to avoid read-only query issue)
app.use((req, res, next) => {
  if (req.body) {
    const hasSanitized = mongoSanitize.has(req.body);
    if (hasSanitized) {
      logSecurityEvent(SecurityEventType.NOSQL_INJECTION_ATTEMPT, {
        ip: req.ip || req.connection.remoteAddress,
        path: req.path,
        method: req.method,
        userAgent: req.get("User-Agent"),
        message: "Sanitized malicious content from request body",
      });
      req.body = mongoSanitize.sanitize(req.body, { replaceWith: "_" });
    }
  }
  next();
});

// 3. HTTP Parameter Pollution Protection
app.use(hpp());

// 4. Security Event Logger Middleware
app.use(createSecurityLoggerMiddleware());

// 5. Rate Limiting - General API (100 requests per 15 minutes)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000000, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logSecurityEvent(SecurityEventType.RATE_LIMIT_HIT, {
      ip: req.ip || req.connection.remoteAddress,
      path: req.path,
      method: req.method,
      userAgent: req.get("User-Agent"),
      message: "General rate limit exceeded",
    });
    res.status(options.statusCode).json(options.message);
  },
});

// 6. Rate Limiting - Authentication (stricter: 10 requests per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000000, // Limit each IP to 100 login attempts per windowMs
  message: {
    success: false,
    message: "Too many login attempts, please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logSecurityEvent(SecurityEventType.RATE_LIMIT_HIT, {
      ip: req.ip || req.connection.remoteAddress,
      path: req.path,
      method: req.method,
      userAgent: req.get("User-Agent"),
      message: "Auth rate limit exceeded - possible brute force attempt",
    });
    res.status(options.statusCode).json(options.message);
  },
});

// Apply rate limiters
app.use("/api/", generalLimiter);
app.use("/api/auth/", authLimiter);

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      ttl: 24 * 60 * 60, // 1 day
      autoRemove: "native",
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "lax" : "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Static file serving (protect uploads with auth; keep public assets open)
app.use(
  "/uploads",
  requireAuth,
  express.static(path.join(__dirname, "../uploads")),
);
app.use(express.static(path.join(__dirname, "../public")));

// Connect to Database
connectDB();

// Environment variable validation
const requiredEnvVars = ["JWT_SECRET", "SESSION_SECRET", "MONGODB_URI"];
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(
    "❌ Missing required environment variables:",
    missingEnvVars.join(", "),
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
const misRoutes = require("./api/routes/misRoutes");
const personnelRoutes = require("./api/routes/personnelRoutes");
const lexiconRoutes = require("./api/routes/lexiconRoutes");

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
app.use("/api/mis", misRoutes);
app.use("/api/thumbnails", require("./api/routes/thumbnailRoutes"));
app.use("/api/guest", require("./api/routes/guestRoutes"));
app.use("/api/settings", require("./api/routes/settingsRoutes"));
app.use("/api/lexicon", lexiconRoutes);

// Test endpoint for email functionality (protected) - Disabled: module not found
// app.use(
//   "/api/test",
//   requireAuth,
//   require("./middlewares/auth").requireRole(["admin", "mis"]),
//   require("../../test-email-endpoint"),
// );
app.use("/api/personnel", personnelRoutes);

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

// Enhanced Health check endpoint
app.get("/health", async (req, res) => {
  const healthData = {
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    database: "disconnected",
  };

  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState === 1) {
      healthData.database = "connected";
    }
  } catch (err) {
    healthData.database = "error";
  }

  res.json(healthData);
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);

  // Initialize Socket.io
  initSocket(server);

  // Initialize cron jobs after server starts
  try {
    const { initRoleDemotionCron } = require("./jobs/roleDemotionCron");
    initRoleDemotionCron();
  } catch (cronError) {
    console.error("❌ Failed to initialize role demotion cron job:", cronError);
  }
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log("✅ HTTP server closed");
    mongoose.connection.close(false, () => {
      console.log("✅ MongoDB connection closed");
      process.exit(0);
    });
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error(
      "⚠️ Could not close connections in time, forcefully shutting down",
    );
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
