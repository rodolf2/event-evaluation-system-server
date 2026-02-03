/**
 * Dynamic CSV Report Service
 * 
 * This service processes CSV column data to generate dynamic reports
 * based on the uploaded CSV file columns in form creation.
 */

class DynamicCSVReportService {
  /**
   * Process dynamic column data from attendee list
   * @param {Array} attendeeList - The attendee list from the form
   * @returns {Object} Processed dynamic data with columns and statistics
   */
  processDynamicColumns(attendeeList) {
    if (!attendeeList || attendeeList.length === 0) {
      return {
        columns: [],
        data: [],
        summary: {
          totalColumns: 0,
          totalAttendees: 0
        }
      };
    }

    // Extract unique column names from attendee list
    const allKeys = new Set();
    attendeeList.forEach(attendee => {
      Object.keys(attendee).forEach(key => {
        if (key !== '_id' && key !== 'userId' && key !== 'hasResponded' && key !== 'uploadedAt') {
          allKeys.add(key);
        }
      });
    });

    const columns = Array.from(allKeys).sort();
    const data = [];

    // Process data for each column
    columns.forEach(column => {
      const columnData = this.processColumn(attendeeList, column);
      data.push(columnData);
    });

    return {
      columns,
      data,
      summary: {
        totalColumns: columns.length,
        totalAttendees: attendeeList.length
      }
    };
  }

  /**
   * Process a single column and extract statistics
   * @param {Array} attendeeList - The attendee list
   * @param {String} columnName - The column name to process
   * @returns {Object} Column statistics and data
   */
  processColumn(attendeeList, columnName) {
    const columnData = {
      columnName,
      type: 'text',
      uniqueValues: new Set(),
      valueCounts: {},
      numericStats: null,
      total: 0,
      nullCount: 0,
      sampleValues: []
    };

    attendeeList.forEach(attendee => {
      const value = attendee[columnName];
      
      if (value === undefined || value === null || value === '') {
        columnData.nullCount++;
        return;
      }

      columnData.uniqueValues.add(value);
      columnData.valueCounts[value] = (columnData.valueCounts[value] || 0) + 1;
      columnData.total++;
    });

    // Determine column type and calculate statistics
    const uniqueValuesArray = Array.from(columnData.uniqueValues);
    columnData.sampleValues = uniqueValuesArray.slice(0, 10);

    // Check if column is numeric
    const numericValues = uniqueValuesArray.filter(v => !isNaN(v) && v !== '');
    if (numericValues.length > 0 && numericValues.length === uniqueValuesArray.length) {
      columnData.type = 'numeric';
      const numericArray = numericValues.map(Number);
      columnData.numericStats = this.calculateNumericStats(numericArray);
    } else {
      columnData.type = 'text';
    }

    // Convert Set to Array for JSON serialization
    columnData.uniqueValues = uniqueValuesArray;

    return columnData;
  }

  /**
   * Calculate numeric statistics for a column
   * @param {Array} values - Array of numeric values
   * @returns {Object} Numeric statistics
   */
  calculateNumericStats(values) {
    if (values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / values.length;
    
    // Calculate median
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 
      ? sorted[mid] 
      : (sorted[mid - 1] + sorted[mid]) / 2;

    // Calculate standard deviation
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: Math.round(mean * 100) / 100,
      median: Math.round(median * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      sum: Math.round(sum * 100) / 100
    };
  }

  /**
   * Generate breakdown data for a specific column
   * @param {Array} attendeeList - The attendee list
   * @param {String} columnName - The column name
   * @param {Array} responses - Form responses (optional, for response rate calculation)
   * @returns {Object} Breakdown data with counts and percentages
   */
  generateColumnBreakdown(attendeeList, columnName, responses = []) {
    const breakdown = {};
    const total = attendeeList.length;

    attendeeList.forEach(attendee => {
      const value = attendee[columnName];
      const key = value || 'Unknown';
      
      if (!breakdown[key]) {
        breakdown[key] = {
          count: 0,
          percentage: 0,
          responded: 0,
          responseRate: 0
        };
      }
      
      breakdown[key].count++;
    });

    // Calculate percentages
    Object.keys(breakdown).forEach(key => {
      breakdown[key].percentage = Math.round((breakdown[key].count / total) * 100);
    });

    // Calculate response rates if responses provided
    if (responses.length > 0) {
      const respondedEmails = new Set(responses.map(r => r.respondentEmail?.toLowerCase()));
      
      attendeeList.forEach(attendee => {
        const value = attendee[columnName];
        const key = value || 'Unknown';
        const email = attendee.email?.toLowerCase();
        
        if (respondedEmails.has(email)) {
          breakdown[key].responded++;
        }
      });

      // Calculate response rates
      Object.keys(breakdown).forEach(key => {
        if (breakdown[key].count > 0) {
          breakdown[key].responseRate = Math.round((breakdown[key].responded / breakdown[key].count) * 100);
        }
      });
    }

    return breakdown;
  }

  /**
   * Generate comparison data between two forms (e.g., current vs previous year)
   * @param {Array} currentAttendees - Current form attendees
   * @param {Array} previousAttendees - Previous form attendees
   * @param {String} columnName - Column to compare
   * @returns {Object} Comparison data
   */
  generateComparisonData(currentAttendees, previousAttendees, columnName) {
    const currentBreakdown = this.generateColumnBreakdown(currentAttendees, columnName);
    const previousBreakdown = this.generateColumnBreakdown(previousAttendees, columnName);

    const comparison = {};
    const allKeys = new Set([...Object.keys(currentBreakdown), ...Object.keys(previousBreakdown)]);

    allKeys.forEach(key => {
      const current = currentBreakdown[key] || { count: 0, percentage: 0 };
      const previous = previousBreakdown[key] || { count: 0, percentage: 0 };

      comparison[key] = {
        current: {
          count: current.count,
          percentage: current.percentage
        },
        previous: {
          count: previous.count,
          percentage: previous.percentage
        },
        change: {
          count: current.count - previous.count,
          percentage: current.percentage - previous.percentage
        }
      };
    });

    return comparison;
  }

  /**
   * Get column suggestions for filtering and analysis
   * @param {Array} attendeeList - The attendee list
   * @returns {Object} Column suggestions
   */
  getColumnSuggestions(attendeeList) {
    const suggestions = {
      filterable: [],
      groupable: [],
      numeric: [],
      categorical: []
    };

    if (!attendeeList || attendeeList.length === 0) {
      return suggestions;
    }

    // Extract all columns
    const allKeys = new Set();
    attendeeList.forEach(attendee => {
      Object.keys(attendee).forEach(key => {
        if (key !== '_id' && key !== 'userId' && key !== 'hasResponded' && key !== 'uploadedAt') {
          allKeys.add(key);
        }
      });
    });

    // Analyze each column
    allKeys.forEach(column => {
      const values = attendeeList.map(a => a[column]).filter(v => v !== undefined && v !== null);
      const uniqueValues = new Set(values);
      const uniqueCount = uniqueValues.size;

      // Numeric columns
      const numericValues = Array.from(uniqueValues).filter(v => !isNaN(v));
      if (numericValues.length > 0 && numericValues.length === uniqueCount) {
        suggestions.numeric.push(column);
        suggestions.filterable.push(column);
      }

      // Categorical columns (few unique values)
      if (uniqueCount <= 10 && uniqueCount > 1) {
        suggestions.categorical.push(column);
        suggestions.groupable.push(column);
        suggestions.filterable.push(column);
      }

      // Text columns with many unique values
      if (uniqueCount > 10) {
        suggestions.filterable.push(column);
      }
    });

    return suggestions;
  }
}

module.exports = new DynamicCSVReportService();
