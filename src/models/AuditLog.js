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
  },
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

  const matchStage = {};

  // Date filters
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }

  // Direct Match filters
  if (category) matchStage.category = category;
  if (action) matchStage.action = { $regex: action, $options: "i" };
  if (userId) matchStage.userId = new mongoose.Types.ObjectId(userId);
  if (severity) matchStage.severity = severity;

  const pipeline = [
    { $match: matchStage },
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "userDetails",
      },
    },
    {
      $unwind: {
        path: "$userDetails",
        preserveNullAndEmptyArrays: true,
      },
    },
  ];

  // Search filter
  if (search) {
    const searchRegex = { $regex: search, $options: "i" };
    pipeline.push({
      $match: {
        $or: [
          { action: searchRegex },
          { description: searchRegex },
          { userName: searchRegex },
          { userEmail: searchRegex },
          { "userDetails.name": searchRegex },
          { "userDetails.email": searchRegex },
        ],
      },
    });
  }

  // Pagination with Facet
  pipeline.push({
    $facet: {
      logs: [
        { $skip: (page - 1) * parseInt(limit) },
        { $limit: parseInt(limit) },
        {
          $project: {
            // Reconstruct the document structure
            _id: 1,
            userId: {
              _id: { $ifNull: ["$userDetails._id", "$userId"] },
              name: { $ifNull: ["$userDetails.name", "$userName"] },
              email: { $ifNull: ["$userDetails.email", "$userEmail"] },
              profilePicture: "$userDetails.profilePicture",
              avatar: "$userDetails.avatar",
            },
            userName: { $ifNull: ["$userDetails.name", "$userName"] },
            userEmail: { $ifNull: ["$userDetails.email", "$userEmail"] },
            action: 1,
            category: 1,
            description: 1,
            ipAddress: 1,
            userAgent: 1,
            metadata: 1,
            severity: 1,
            status: 1,
            createdAt: 1,
            updatedAt: 1,
            userRole: "$userDetails.role",
          },
        },
      ],
      totalCount: [{ $count: "count" }],
    },
  });

  const [result] = await this.aggregate(pipeline);

  const logs = result.logs || [];
  const total = result.totalCount[0] ? result.totalCount[0].count : 0;

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
