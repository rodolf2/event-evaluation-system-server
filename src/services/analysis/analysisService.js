const Feedback = require('../../models/Feedback');
const Event = require('../../models/Event');
const Form = require('../../models/Form');
const mongoose = require('mongoose');
const path = require('path');
const { PythonShell } = require('python-shell');

/**
 * Calculates the average rating for a given event.
 * @param {string} eventId - The ID of the event to analyze.
 * @returns {Promise<number>} The average rating for the event.
 */
const getAverageRating = async (eventId) => {
  const averageRating = await Feedback.aggregate([
    { $match: { eventId: eventId } },
    { $group: { _id: '$eventId', avgRating: { $avg: '$rating' } } },
  ]);

  return averageRating.length > 0 ? averageRating[0].avgRating : 0;
};

const generateQualitativeReport = async (eventId) => {
  const feedbacks = await Feedback.find({ eventId });

  if (feedbacks.length === 0) {
    return {
      summary: { positive: 0, neutral: 0, negative: 0 },
      insights: 'No feedback available to generate insights.',
      recommendations: 'Encourage participants to provide feedback.',
      comments: { positive: [], neutral: [], negative: [] },
    };
  }

  // Extract comments from feedbacks
  const comments = feedbacks.map(fb => fb.comment).filter(comment => comment && comment.trim());

  if (comments.length === 0) {
    return {
      summary: { positive: 0, neutral: 0, negative: 0 },
      insights: 'No valid feedback comments available to generate insights.',
      recommendations: 'Encourage participants to provide detailed feedback.',
      comments: { positive: [], neutral: [], negative: [] },
    };
  }

  try {
    // Call Python script for text analysis
    const pythonResult = await new Promise((resolve, reject) => {
      const scriptPath = path.resolve(process.cwd(), 'text_analysis.py');
      const pythonPath = process.platform === 'win32'
        ? path.resolve(process.cwd(), 'venv', 'Scripts', 'python.exe')
        : path.resolve(process.cwd(), 'venv', 'bin', 'python');
      const pyshell = new PythonShell(scriptPath, { pythonPath });

      // Send data to Python script
      pyshell.send(JSON.stringify({
        action: 'generate_report',
        feedbacks: comments
      }));

      let result = '';
      pyshell.on('message', (message) => {
        result += message;
      });

      pyshell.end((err) => {
        if (err) {
          reject(err);
        } else {
          try {
            resolve(JSON.parse(result));
          } catch (parseErr) {
            reject(parseErr);
          }
        }
      });
    });

    return pythonResult;
  } catch (error) {
    console.error('Error calling Python script:', error);
    // Fallback to basic analysis if Python script fails
    return {
      summary: { positive: 0, neutral: 0, negative: 0 },
      insights: 'Error analyzing feedback. Please try again.',
      recommendations: 'Technical issues occurred during analysis.',
      comments: { positive: [], neutral: [], negative: [] },
    };
  }
};

const generateQuantitativeReport = async (eventId) => {
  const currentEvent = await Event.findById(eventId);
  if (!currentEvent) {
    throw new Error('Event not found');
  }

  // Find the corresponding event from the previous year
  const lastYear = new Date(currentEvent.date);
  lastYear.setFullYear(lastYear.getFullYear() - 1);

  const previousEvent = await Event.findOne({
    name: currentEvent.name,
    date: {
      $gte: new Date(lastYear.getFullYear(), 0, 1),
      $lt: new Date(lastYear.getFullYear() + 1, 0, 1),
    },
  });

  // Get current year feedback data
  const currentYearFeedbacks = await Feedback.find({ eventId: new mongoose.Types.ObjectId(eventId) });
  const currentYearData = {
    ratings: currentYearFeedbacks.map(fb => fb.rating).filter(r => r != null),
    responseCount: currentYearFeedbacks.length
  };

  let previousYearData = { ratings: [], responseCount: 0 };
  if (previousEvent) {
    const previousYearFeedbacks = await Feedback.find({ eventId: previousEvent._id });
    previousYearData = {
      ratings: previousYearFeedbacks.map(fb => fb.rating).filter(r => r != null),
      responseCount: previousYearFeedbacks.length
    };
  }

  try {
    // Use Python for statistical analysis
    const quantitativeResult = await new Promise((resolve, reject) => {
      const scriptPath = path.resolve(process.cwd(), 'text_analysis.py');
      const pythonPath = process.platform === 'win32'
        ? path.resolve(process.cwd(), 'venv', 'Scripts', 'python.exe')
        : path.resolve(process.cwd(), 'venv', 'bin', 'python');
      const pyshell = new PythonShell(scriptPath, { pythonPath });

      pyshell.send(JSON.stringify({
        action: 'analyze_quantitative',
        currentYearData: currentYearData,
        previousYearData: previousYearData,
        currentYear: currentEvent.date.getFullYear(),
        previousYear: previousEvent ? previousEvent.date.getFullYear() : lastYear.getFullYear()
      }));

      let result = '';
      pyshell.on('message', (message) => {
        result += message;
      });

      pyshell.end((err) => {
        if (err) {
          reject(err);
        } else {
          try {
            resolve(JSON.parse(result));
          } catch (parseErr) {
            reject(parseErr);
          }
        }
      });
    });

    return quantitativeResult;
  } catch (error) {
    console.error('Error calling Python quantitative analysis:', error);

    // Fallback to basic calculations if Python script fails
    const calculateStats = (ratings) => {
      if (ratings.length === 0) return { avgRating: 0, responseCount: 0 };
      const sum = ratings.reduce((a, b) => a + b, 0);
      return {
        avgRating: sum / ratings.length,
        responseCount: ratings.length
      };
    };

    const currentStats = calculateStats(currentYearData.ratings);
    const previousStats = calculateStats(previousYearData.ratings);

    return {
      currentYear: {
        year: currentEvent.date.getFullYear(),
        averageRating: currentStats.avgRating,
        responseCount: currentStats.responseCount,
      },
      previousYear: {
        year: previousEvent ? previousEvent.date.getFullYear() : lastYear.getFullYear(),
        averageRating: previousStats.avgRating,
        responseCount: previousStats.responseCount,
      },
    };
  }
};

module.exports = {
  getAverageRating,
  generateQualitativeReport,
  generateQuantitativeReport,
  analyzeResponses,
  generateResponseOverview,
};

/**
 * Analyzes form responses for sentiment and breakdown
 * @param {Array} responses - Array of form responses
 * @returns {Object} Analysis results with sentiment breakdown
 */
function analyzeResponses(responses) {
  if (!responses || responses.length === 0) {
    return {
      sentimentBreakdown: {
        positive: { count: 0, percentage: 0 },
        neutral: { count: 0, percentage: 0 },
        negative: { count: 0, percentage: 0 }
      }
    };
  }

  let positiveCount = 0;
  let neutralCount = 0;
  let negativeCount = 0;

  // Simple keyword-based sentiment analysis
  const positiveKeywords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'like', 'best', 'awesome', 'perfect', 'satisfied', 'happy', 'pleased'];
  const negativeKeywords = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'dislike', 'worst', 'disappointed', 'unsatisfied', 'sad', 'angry', 'frustrated', 'poor', 'fail'];
  
  responses.forEach(response => {
    if (response.responses && Array.isArray(response.responses)) {
      let textContent = '';
      
      // Extract text from all responses
      response.responses.forEach(q => {
        if (typeof q.answer === 'string') {
          textContent += ' ' + q.answer.toLowerCase();
        } else if (Array.isArray(q.answer)) {
          textContent += ' ' + q.answer.join(' ').toLowerCase();
        }
      });
      
      if (textContent.trim()) {
        // Count keyword matches
        const positiveMatches = positiveKeywords.filter(keyword => textContent.includes(keyword)).length;
        const negativeMatches = negativeKeywords.filter(keyword => textContent.includes(keyword)).length;
        
        // Determine sentiment
        if (positiveMatches > negativeMatches && positiveMatches > 0) {
          positiveCount++;
        } else if (negativeMatches > positiveMatches && negativeMatches > 0) {
          negativeCount++;
        } else {
          neutralCount++;
        }
      } else {
        // If no text content, treat as neutral
        neutralCount++;
      }
    }
  });

  const total = responses.length;
  return {
    sentimentBreakdown: {
      positive: {
        count: positiveCount,
        percentage: total > 0 ? Math.round((positiveCount / total) * 100 * 100) / 100 : 0
      },
      neutral: {
        count: neutralCount,
        percentage: total > 0 ? Math.round((neutralCount / total) * 100 * 100) / 100 : 0
      },
      negative: {
        count: negativeCount,
        percentage: total > 0 ? Math.round((negativeCount / total) * 100 * 100) / 100 : 0
      }
    }
  };
}

/**
 * Generates time series data for response overview
 * @param {Array} responses - Array of form responses
 * @param {Date} startDate - Start date for the time series (optional)
 * @param {Date} endDate - End date for the time series (optional)
 * @returns {Object} Time series data for charts
 */
function generateResponseOverview(responses, startDate = null, endDate = null) {
  if (!responses || responses.length === 0) {
    return {
      labels: [],
      data: [],
      dateRange: "No responses available"
    };
  }

  // Default date range: from form creation to now or last response
  const dates = responses.map(r => new Date(r.submittedAt)).filter(d => !isNaN(d));
  if (dates.length === 0) {
    return {
      labels: [],
      data: [],
      dateRange: "No response dates available"
    };
  }

  const minDate = startDate || new Date(Math.min(...dates));
  const maxDate = endDate || new Date(Math.max(...dates));

  // Generate weekly buckets
  const weekLabels = [];
  const weekData = [];
  const current = new Date(minDate);
  const end = new Date(maxDate);

  // Set to start of week (Monday)
  const dayOfWeek = current.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  current.setDate(current.getDate() - daysToMonday);
  current.setHours(0, 0, 0, 0);

  while (current <= end) {
    const weekStart = new Date(current);
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Count responses in this week
    const weekResponses = responses.filter(r => {
      const responseDate = new Date(r.submittedAt);
      return responseDate >= weekStart && responseDate <= weekEnd;
    });

    // Format label
    const month = weekStart.toLocaleDateString('en-US', { month: 'short' });
    const day = weekStart.getDate();
    weekLabels.push(`${month} ${day}`);

    // Count cumulative responses up to this week
    const cumulativeCount = responses.filter(r => {
      const responseDate = new Date(r.submittedAt);
      return responseDate <= weekEnd;
    }).length;

    weekData.push(cumulativeCount);

    // Move to next week
    current.setDate(current.getDate() + 7);
  }

  // Format date range string
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return {
    labels: weekLabels,
    data: weekData,
    dateRange: `${formatDate(minDate)} - ${formatDate(maxDate)}`
  };
}
