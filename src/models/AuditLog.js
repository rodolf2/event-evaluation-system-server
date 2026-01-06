const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // Allow null for system-generated events
    },
    userEmail: {
      type: String,
      default: null,
    },
    userName: {
      type: String,
      default: null,
    },
    action: {
      type: String,
      required: [true, "Action is required"],
      trim: true,
      maxlength: [100, "Action cannot exceed 100 characters"],
    },
    category: {
      type: String,
      enum: [
        "auth",
        "user",
        "form",
        "evaluation",
        "certificate",
        "report",
        "notification",
        "system",
        "security",
        "settings",
      ],
      default: "system",
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    metadata: {
      // Contextual data about the action
      targetId: mongoose.Schema.Types.ObjectId,
      targetType: String,
      oldValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed,
      additionalInfo: mongoose.Schema.Types.Mixed,
    },
    severity: {
      type: String,
      enum: ["info", "warning", "critical"],
      default: "info",
    },
    status: {
      type: String,
      enum: ["success", "failure", "pending"],
      default: "success",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ category: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ severity: 1, createdAt: -1 });

// Static method to log an audit event
auditLogSchema.statics.logEvent = async function (eventData) {
  try {
    const log = new this(eventData);
    await log.save();
    return log;
  } catch (error) {
    console.error("Failed to log audit event:", error);
    return null;
  }
};

// Static method to get logs with pagination and filters
auditLogSchema.statics.getLogsWithFilters = async function (filters = {}) {
  const {
    page = 1,
    limit = 20,
    startDate,
    endDate,
    category,
    action,
    userId,
    severity,
    search,
  } = filters;

  const query = {};

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  if (category) query.category = category;
  if (action) query.action = { $regex: action, $options: "i" };
  if (userId) query.userId = userId;
  if (severity) query.severity = severity;

  if (search) {
    query.$or = [
      { action: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { userName: { $regex: search, $options: "i" } },
      { userEmail: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("userId", "name email")
      .lean(),
    this.countDocuments(query),
  ]);

  return {
    logs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

module.exports = mongoose.model("AuditLog", auditLogSchema);
