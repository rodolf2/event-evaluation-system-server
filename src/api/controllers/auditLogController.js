const AuditLog = require("../../models/AuditLog");
const User = require("../../models/User");
const PDFDocument = require("pdfkit");

/**
 * Get paginated audit logs with filters
 */
const getAuditLogs = async (req, res) => {
  try {
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
      timeRange,
    } = req.query;

    // Handle timeRange if present
    let queryStartDate = startDate;
    if (timeRange && !startDate) {
      const now = new Date();
      if (timeRange === "24h")
        queryStartDate = new Date(now - 24 * 60 * 60 * 1000);
      else if (timeRange === "7d")
        queryStartDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
      else if (timeRange === "30d")
        queryStartDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
    }

    const result = await AuditLog.getLogsWithFilters({
      page,
      limit,
      startDate: queryStartDate,
      endDate,
      category,
      action,
      userId,
      severity,
      search,
    });

    res.json({
      success: true,
      data: result.logs,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch audit logs",
      error: error.message,
    });
  }
};

/**
 * Get audit log statistics for dashboard
 */
const getAuditLogStats = async (req, res) => {
  try {
    const now = new Date();
    const last24Hours = new Date(now - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now - 30 * 24 * 60 * 60 * 1000);

    // Get various stats
    const [
      totalLogs,
      last24HoursCount,
      previous24HoursCount,
      last7DaysCount,
      categoryBreakdown,
      severityBreakdown,
      recentCritical,
      actionsToday,
    ] = await Promise.all([
      AuditLog.countDocuments(),
      AuditLog.countDocuments({ createdAt: { $gte: last24Hours } }),
      AuditLog.countDocuments({
        createdAt: {
          $gte: new Date(now - 48 * 60 * 60 * 1000),
          $lt: last24Hours,
        },
      }),
      AuditLog.countDocuments({ createdAt: { $gte: last7Days } }),
      AuditLog.aggregate([
        { $match: { createdAt: { $gte: last30Days } } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      AuditLog.aggregate([
        { $match: { createdAt: { $gte: last30Days } } },
        { $group: { _id: "$severity", count: { $sum: 1 } } },
      ]),
      AuditLog.find({ severity: "critical" })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      AuditLog.aggregate([
        { $match: { createdAt: { $gte: last24Hours } } },
        { $group: { _id: "$action", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        totalLogs,
        totalLogs,
        last24HoursCount,
        previous24HoursCount,
        last7DaysCount,
        categoryBreakdown: categoryBreakdown.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        severityBreakdown: severityBreakdown.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        recentCritical,
        topActionsToday: actionsToday,
      },
    });
  } catch (error) {
    console.error("Error fetching audit log stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch audit log statistics",
      error: error.message,
    });
  }
};

/**
 * Create an audit log entry (internal use)
 */
const createAuditLog = async (eventData) => {
  try {
    return await AuditLog.logEvent(eventData);
  } catch (error) {
    console.error("Error creating audit log:", error);
    return null;
  }
};

/**
 * Export audit logs to CSV format
 */
const exportAuditLogs = async (req, res) => {
  try {
    const { startDate, endDate, category, severity, format, timeRange } =
      req.query;

    const query = {};

    // Handle timeRange for Export
    let queryStartDate = startDate;
    if (timeRange && !startDate) {
      const now = new Date();
      if (timeRange === "24h")
        queryStartDate = new Date(now - 24 * 60 * 60 * 1000);
      else if (timeRange === "7d")
        queryStartDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
      else if (timeRange === "30d")
        queryStartDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
    }

    if (queryStartDate || endDate) {
      query.createdAt = {};
      if (queryStartDate) query.createdAt.$gte = new Date(queryStartDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (category) query.category = category;
    if (severity) query.severity = severity;

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(1000) // Limit PDF rows to avoid timeout
      .populate("userId", "name email")
      .lean();

    if (format === "pdf") {
      const doc = new PDFDocument({ margin: 50 });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=audit-logs-${Date.now()}.pdf`
      );

      doc.pipe(res);

      // Header
      doc.fontSize(20).text("Audit Logs Report", { align: "center" });
      doc.moveDown();
      doc
        .fontSize(12)
        .text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
      doc.moveDown();

      // Filters summary
      if (startDate || endDate || category || severity) {
        doc.fontSize(10).text("Filters applied:", { underline: true });
        if (startDate) doc.text(`Start: ${startDate}`);
        if (endDate) doc.text(`End: ${endDate}`);
        if (category) doc.text(`Category: ${category}`);
        if (severity) doc.text(`Severity: ${severity}`);
        doc.moveDown();
      }

      // Logs List
      doc.fontSize(10);
      let y = doc.y;

      logs.forEach((log, index) => {
        // Simple block per log
        if (y > 700) {
          doc.addPage();
          y = 50;
        }

        const time = new Date(log.createdAt).toLocaleString();
        const user = log.userName || "System";
        const action = log.action;
        const details = log.description || "";

        doc
          .font("Helvetica-Bold")
          .text(`[${time}] ${action} - ${user}`, { continued: false });

        doc.font("Helvetica").fillColor("gray").text(details, { width: 500 });

        doc.fillColor("black").moveDown(0.5);
        y = doc.y;
      });

      doc.end();
      return;
    }

    // Default: CSV Export
    // Generate CSV header
    const headers = [
      "Timestamp",
      "User",
      "Email",
      "Action",
      "Category",
      "Description",
      "Severity",
      "IP Address",
      "Status",
    ];

    // Generate CSV rows
    const rows = logs.map((log) => [
      new Date(log.createdAt).toISOString(),
      log.userName || "System",
      log.userEmail || "N/A",
      log.action,
      log.category,
      log.description.replace(/,/g, ";"),
      log.severity,
      log.ipAddress || "N/A",
      log.status,
    ]);

    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join(
      "\n"
    );

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=audit-logs-${Date.now()}.csv`
    );
    res.send(csv);
  } catch (error) {
    console.error("Error exporting audit logs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export audit logs",
      error: error.message,
    });
  }
};

/**
 * Get available filter options
 */
const getFilterOptions = async (req, res) => {
  try {
    const [categories, actions, severities] = await Promise.all([
      AuditLog.distinct("category"),
      AuditLog.distinct("action"),
      AuditLog.distinct("severity"),
    ]);

    res.json({
      success: true,
      data: {
        categories,
        actions,
        severities,
      },
    });
  } catch (error) {
    console.error("Error fetching filter options:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch filter options",
      error: error.message,
    });
  }
};

module.exports = {
  getAuditLogs,
  getAuditLogStats,
  createAuditLog,
  exportAuditLogs,
  getFilterOptions,
};
