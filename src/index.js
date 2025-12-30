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
const connectDB = require("./utils/db");
const { requireAuth } = require("./middlewares/auth");
const User = require("./models/User");

// Configure Passport
require("./config/passport");

const app = express();

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
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Security headers (keep CSP off to avoid breaking existing inline assets)
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

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
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Static file serving (protect uploads with auth; keep public assets open)
app.use(
  "/uploads",
  requireAuth,
  express.static(path.join(__dirname, "../uploads"))
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
const misRoutes = require("./api/routes/misRoutes");
const personnelRoutes = require("./api/routes/personnelRoutes");

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
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
