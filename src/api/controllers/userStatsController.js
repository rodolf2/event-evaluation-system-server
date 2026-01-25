const User = require("../../models/User");
const Form = require("../../models/Form");
const Activity = require("../../models/Activity");

/**
 * Get comprehensive user statistics
 */
const getUserStatistics = async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last7Days = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const last6Months = new Date(now.setMonth(now.getMonth() - 6));

    // Basic user counts
    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      guestUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false }),
      User.countDocuments({ isGuest: true }),
      User.countDocuments({ createdAt: { $gte: today } }),
      User.countDocuments({ createdAt: { $gte: last7Days } }),
      User.countDocuments({ createdAt: { $gte: last30Days } }),
    ]);

    // User distribution by role
    const roleDistribution = await User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // User registration trend (last 6 months, grouped by month)
    const registrationTrend = await User.aggregate([
      { $match: { createdAt: { $gte: last6Months } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Format registration trend for chart
    const formattedRegistrationTrend = registrationTrend.map((item) => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
      count: item.count,
    }));

    // Login activity trend (last 30 days)
    const loginTrend = await User.aggregate([
      { $match: { lastLogin: { $gte: last30Days } } },
      {
        $group: {
          _id: {
            year: { $year: "$lastLogin" },
            month: { $month: "$lastLogin" },
            day: { $dayOfMonth: "$lastLogin" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    // Format login trend for chart
    const formattedLoginTrend = loginTrend.map((item) => ({
      date: `${item._id.year}-${String(item._id.month).padStart(
        2,
        "0",
      )}-${String(item._id.day).padStart(2, "0")}`,
      count: item.count,
    }));

    // Recent user registrations
    const recentRegistrations = await User.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select("name email role createdAt isActive profilePicture avatar")
      .lean();

    // Users by department (if applicable)
    const departmentDistribution = await User.aggregate([
      { $match: { department: { $ne: null } } },
      { $group: { _id: "$department", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Active users by time of day (based on last login)
    const activeByHour = await User.aggregate([
      { $match: { lastLogin: { $gte: last7Days } } },
      {
        $group: {
          _id: { $hour: "$lastLogin" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          activeUsers,
          inactiveUsers,
          guestUsers,
          newUsersToday,
          newUsersThisWeek,
          newUsersThisMonth,
        },
        roleDistribution: roleDistribution.map((item) => ({
          role: item._id,
          count: item.count,
          percentage: ((item.count / totalUsers) * 100).toFixed(1),
        })),
        registrationTrend: formattedRegistrationTrend,
        loginTrend: formattedLoginTrend,
        recentRegistrations,
        departmentDistribution: departmentDistribution.map((item) => ({
          department: item._id || "Not Specified",
          count: item.count,
        })),
        activeByHour: activeByHour.map((item) => ({
          hour: item._id,
          count: item.count,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching user statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user statistics",
      error: error.message,
    });
  }
};

/**
 * Get top active users
 */
const getTopActiveUsers = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Get users with most recent logins
    const topUsers = await User.find({ lastLogin: { $ne: null } })
      .sort({ lastLogin: -1 })
      .limit(parseInt(limit))
      .select("name email role lastLogin createdAt profilePicture avatar")
      .lean();

    // Get activity counts per user
    const activityCounts = await Activity.aggregate([
      { $group: { _id: "$userId", activityCount: { $sum: 1 } } },
      { $sort: { activityCount: -1 } },
      { $limit: parseInt(limit) },
    ]);

    // Merge with user data
    const userIds = activityCounts.map((a) => a._id);
    const activeUsers = await User.find({ _id: { $in: userIds } })
      .select("name email role profilePicture avatar")
      .lean();

    const topActiveUsers = activityCounts.map((ac) => {
      const user = activeUsers.find(
        (u) => u._id.toString() === ac._id.toString(),
      );
      return {
        ...user,
        activityCount: ac.activityCount,
      };
    });

    res.json({
      success: true,
      data: {
        recentlyActive: topUsers,
        mostActive: topActiveUsers,
      },
    });
  } catch (error) {
    console.error("Error fetching top active users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch top active users",
      error: error.message,
    });
  }
};

module.exports = {
  getUserStatistics,
  getTopActiveUsers,
};
