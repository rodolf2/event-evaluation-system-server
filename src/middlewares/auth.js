const jwt = require("jsonwebtoken");

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// Middleware to check if user is authenticated
const requireAuth = async (req, res, next) => {
  try {
    let token = req.header("Authorization")?.replace("Bearer ", "");

    // Also check query parameter for token (useful for images/downloads)
    if (!token && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user exists and is active
    const User = require("../models/User");
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User account is inactive or not found.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Invalid token.",
    });
  }
};

// Middleware to check if user is super admin
const requireSuperAdmin = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user exists and is super admin
    const User = require("../models/User");
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found.",
      });
    }

    // Check if user is admin (flexible for development)
    const isProduction = process.env.NODE_ENV === "production";
    const isAdminByEmail = isProduction
      ? user.email.endsWith("@laverdad.edu.ph")
      : user.email.includes("admin");
    if (user.role !== "admin" && !isAdminByEmail) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Super admin required.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Invalid token.",
    });
  }
};

// Middleware to check if user is the owner of the resource or super admin
const requireOwnerOrAdmin = (resourceUserIdField = "userId") => {
  return async (req, res, next) => {
    try {
      const token = req.header("Authorization")?.replace("Bearer ", "");

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Access denied. No token provided.",
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const User = require("../models/User");
      const user = await User.findById(decoded.id);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found.",
        });
      }

      // Check if user is super admin or owner of the resource (flexible for development)
      const isProduction = process.env.NODE_ENV === "production";
      const isSuperAdmin =
        user.role === "admin" ||
        (isProduction
          ? user.email.endsWith("@laverdad.edu.ph")
          : user.email.includes("admin"));
      const isOwner =
        user._id.toString() === req.body[resourceUserIdField] ||
        user._id.toString() === req.params[resourceUserIdField];

      if (!isSuperAdmin && !isOwner) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Insufficient permissions.",
        });
      }

      req.user = user;
      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        message: "Invalid token.",
      });
    }
  };
};

const requireRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      const token = req.header("Authorization")?.replace("Bearer ", "");

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Access denied. No token provided.",
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const User = require("../models/User");
      const user = await User.findById(decoded.id);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found.",
        });
      }

      console.log("User role:", user.role, "Allowed roles:", allowedRoles);
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Insufficient permissions.",
        });
      }

      req.user = user;
      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        message: "Invalid token.",
      });
    }
  };
};

module.exports = {
  generateToken,
  requireAuth,
  requireSuperAdmin,
  requireOwnerOrAdmin,
  requireRole,
};
