const { query } = require('../config/database');

// Log therapist activity
const logActivity = async (therapistId, activityType, description, metadata = {}, ipAddress = null, userAgent = null) => {
  try {
    await query(
      `INSERT INTO therapist_activities (therapist_id, activity_type, activity_description, metadata, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [therapistId, activityType, description, JSON.stringify(metadata), ipAddress, userAgent]
    );
  } catch (error) {
    console.error('Error logging therapist activity:', error);
    // Don't throw error to avoid breaking the main operation
  }
};

// Get therapist activities with pagination
const getTherapistActivities = async (therapistId, options = {}) => {
  try {
    const {
      limit = 20,
      offset = 0,
      activityType = null,
      startDate = null,
      endDate = null
    } = options;

    let whereClause = 'WHERE therapist_id = $1';
    const values = [therapistId];
    let paramCount = 2;

    if (activityType) {
      whereClause += ` AND activity_type = $${paramCount}`;
      values.push(activityType);
      paramCount++;
    }

    if (startDate) {
      whereClause += ` AND created_at >= $${paramCount}`;
      values.push(startDate);
      paramCount++;
    }

    if (endDate) {
      whereClause += ` AND created_at <= $${paramCount}`;
      values.push(endDate);
      paramCount++;
    }

    const result = await query(
      `SELECT id, activity_type, activity_description, metadata, created_at
       FROM therapist_activities
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...values, limit, offset]
    );

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM therapist_activities ${whereClause}`,
      values.slice(0, -2) // Remove limit and offset from count query
    );

    return {
      activities: result.rows,
      total: parseInt(countResult.rows[0].total)
    };
  } catch (error) {
    console.error('Error getting therapist activities:', error);
    throw error;
  }
};

// Get activity summary for a therapist
const getActivitySummary = async (therapistId, days = 30) => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await query(
      `SELECT 
         activity_type,
         COUNT(*) as count,
         MAX(created_at) as last_activity
       FROM therapist_activities
       WHERE therapist_id = $1 AND created_at >= $2
       GROUP BY activity_type
       ORDER BY count DESC`,
      [therapistId, startDate.toISOString()]
    );

    return result.rows;
  } catch (error) {
    console.error('Error getting activity summary:', error);
    throw error;
  }
};

// Clean old activities (for maintenance)
const cleanOldActivities = async (daysToKeep = 365) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await query(
      `DELETE FROM therapist_activities WHERE created_at < $1`,
      [cutoffDate.toISOString()]
    );

    console.log(`Cleaned ${result.rowCount} old therapist activity records`);
    return result.rowCount;
  } catch (error) {
    console.error('Error cleaning old activities:', error);
    throw error;
  }
};

module.exports = {
  logActivity,
  getTherapistActivities,
  getActivitySummary,
  cleanOldActivities
};