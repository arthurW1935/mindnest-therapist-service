const { query } = require('../config/database');

class Therapist {
  // Create a new therapist (called from auth service)
  static async create(therapistData) {
    try {
      const { auth_user_id, email, verification_status = 'pending' } = therapistData;
      
      const result = await query(
        `INSERT INTO therapists (auth_user_id, email, verification_status) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
        [auth_user_id, email, verification_status]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error creating therapist:', error);
      throw error;
    }
  }

  // Get therapist by ID
  static async findById(id) {
    try {
      const result = await query(
        `SELECT t.*, 
                tp.first_name, tp.last_name, tp.title, tp.bio, tp.years_experience,
                tp.education, tp.certifications, tp.languages_spoken, tp.phone,
                tp.license_number, tp.license_state, tp.profile_picture_url,
                tp.session_rate, tp.currency, tp.timezone,
                COALESCE(ROUND(AVG(tr.rating), 2), 0) as average_rating,
                COUNT(tr.id) as review_count
         FROM therapists t
         LEFT JOIN therapist_profiles tp ON t.id = tp.therapist_id
         LEFT JOIN therapist_reviews tr ON t.id = tr.therapist_id AND tr.is_public = true
         WHERE t.id = $1 AND t.is_active = true
         GROUP BY t.id, tp.id`,
        [id]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error finding therapist by ID:', error);
      throw error;
    }
  }

  // Get therapist by auth_user_id
  static async findByAuthUserId(authUserId) {
    try {
      const result = await query(
        `SELECT t.*, 
                tp.first_name, tp.last_name, tp.title, tp.bio, tp.years_experience,
                tp.education, tp.certifications, tp.languages_spoken, tp.phone,
                tp.license_number, tp.license_state, tp.profile_picture_url,
                tp.session_rate, tp.currency, tp.timezone,
                COALESCE(ROUND(AVG(tr.rating), 2), 0) as average_rating,
                COUNT(tr.id) as review_count
         FROM therapists t
         LEFT JOIN therapist_profiles tp ON t.id = tp.therapist_id
         LEFT JOIN therapist_reviews tr ON t.id = tr.therapist_id AND tr.is_public = true
         WHERE t.auth_user_id = $1 AND t.is_active = true
         GROUP BY t.id, tp.id`,
        [authUserId]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error finding therapist by auth user ID:', error);
      throw error;
    }
  }

  // Get therapist by email
  static async findByEmail(email) {
    try {
      const result = await query(
        `SELECT t.*, 
                tp.first_name, tp.last_name, tp.title, tp.bio, tp.years_experience,
                tp.education, tp.certifications, tp.languages_spoken, tp.phone,
                tp.license_number, tp.license_state, tp.profile_picture_url,
                tp.session_rate, tp.currency, tp.timezone
         FROM therapists t
         LEFT JOIN therapist_profiles tp ON t.id = tp.therapist_id
         WHERE t.email = $1 AND t.is_active = true`,
        [email]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error finding therapist by email:', error);
      throw error;
    }
  }

  // Update therapist basic info
  static async update(id, therapistData) {
    try {
      const { email, is_active, verification_status, verification_notes } = therapistData;
      const fields = [];
      const values = [];
      let paramCount = 1;

      if (email !== undefined) {
        fields.push(`email = $${paramCount++}`);
        values.push(email);
      }
      if (is_active !== undefined) {
        fields.push(`is_active = $${paramCount++}`);
        values.push(is_active);
      }
      if (verification_status !== undefined) {
        fields.push(`verification_status = $${paramCount++}`);
        values.push(verification_status);
        
        if (verification_status === 'verified') {
          fields.push(`is_verified = $${paramCount++}`);
          values.push(true);
        }
      }
      if (verification_notes !== undefined) {
        fields.push(`verification_notes = $${paramCount++}`);
        values.push(verification_notes);
      }

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(id);
      const result = await query(
        `UPDATE therapists SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error updating therapist:', error);
      throw error;
    }
  }

  // Soft delete therapist
  static async delete(id) {
    try {
      const result = await query(
        `UPDATE therapists SET is_active = false WHERE id = $1 RETURNING *`,
        [id]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error deleting therapist:', error);
      throw error;
    }
  }

  // Get all therapists with filters
  static async findAll(filters = {}) {
    try {
      let whereClause = 'WHERE t.is_active = true';
      const values = [];
      let paramCount = 1;

      // Build WHERE clause based on filters
      if (filters.verification_status) {
        whereClause += ` AND t.verification_status = $${paramCount++}`;
        values.push(filters.verification_status);
      }

      if (filters.is_verified !== undefined) {
        whereClause += ` AND t.is_verified = $${paramCount++}`;
        values.push(filters.is_verified);
      }

      if (filters.specializations && filters.specializations.length > 0) {
        whereClause += ` AND EXISTS (
          SELECT 1 FROM therapist_specializations ts 
          JOIN specializations s ON ts.specialization_id = s.id 
          WHERE ts.therapist_id = t.id AND s.name = ANY($${paramCount++})
        )`;
        values.push(filters.specializations);
      }

      if (filters.approaches && filters.approaches.length > 0) {
        whereClause += ` AND EXISTS (
          SELECT 1 FROM therapist_approaches ta 
          JOIN therapy_approaches a ON ta.approach_id = a.id 
          WHERE ta.therapist_id = t.id AND a.name = ANY($${paramCount++})
        )`;
        values.push(filters.approaches);
      }

      if (filters.languages && filters.languages.length > 0) {
        whereClause += ` AND tp.languages_spoken && $${paramCount++}`;
        values.push(filters.languages);
      }

      if (filters.min_rating) {
        whereClause += ` AND COALESCE(AVG(tr.rating), 0) >= $${paramCount++}`;
        values.push(filters.min_rating);
      }

      if (filters.max_rate) {
        whereClause += ` AND tp.session_rate <= $${paramCount++}`;
        values.push(filters.max_rate);
      }

      if (filters.search) {
        whereClause += ` AND (
          tp.first_name ILIKE $${paramCount} OR 
          tp.last_name ILIKE $${paramCount} OR 
          tp.bio ILIKE $${paramCount} OR
          t.email ILIKE $${paramCount++}
        )`;
        values.push(`%${filters.search}%`);
      }

      const limit = filters.limit || 20;
      const offset = filters.offset || 0;

      // Order by clause
      let orderClause = 'ORDER BY';
      if (filters.sort_by === 'rating') {
        orderClause += ' average_rating DESC, review_count DESC';
      } else if (filters.sort_by === 'experience') {
        orderClause += ' tp.years_experience DESC';
      } else if (filters.sort_by === 'rate') {
        orderClause += ' tp.session_rate ASC';
      } else {
        orderClause += ' t.created_at DESC';
      }

      const result = await query(
        `SELECT t.id, t.auth_user_id, t.email, t.is_verified, t.verification_status, t.created_at,
                tp.first_name, tp.last_name, tp.title, tp.bio, tp.years_experience,
                tp.languages_spoken, tp.session_rate, tp.currency, tp.profile_picture_url,
                COALESCE(ROUND(AVG(tr.rating), 2), 0) as average_rating,
                COUNT(DISTINCT tr.id) as review_count,
                ARRAY_AGG(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL) as specializations,
                ARRAY_AGG(DISTINCT a.name) FILTER (WHERE a.name IS NOT NULL) as approaches
         FROM therapists t
         LEFT JOIN therapist_profiles tp ON t.id = tp.therapist_id
         LEFT JOIN therapist_reviews tr ON t.id = tr.therapist_id AND tr.is_public = true
         LEFT JOIN therapist_specializations ts ON t.id = ts.therapist_id
         LEFT JOIN specializations s ON ts.specialization_id = s.id
         LEFT JOIN therapist_approaches ta ON t.id = ta.therapist_id
         LEFT JOIN therapy_approaches a ON ta.approach_id = a.id
         ${whereClause}
         GROUP BY t.id, tp.id
         ${orderClause}
         LIMIT $${paramCount++} OFFSET $${paramCount}`,
        [...values, limit, offset]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error finding all therapists:', error);
      throw error;
    }
  }

  // Get therapist count
  static async getCount(filters = {}) {
    try {
      let whereClause = 'WHERE t.is_active = true';
      const values = [];
      let paramCount = 1;

      if (filters.verification_status) {
        whereClause += ` AND t.verification_status = $${paramCount++}`;
        values.push(filters.verification_status);
      }

      if (filters.is_verified !== undefined) {
        whereClause += ` AND t.is_verified = $${paramCount++}`;
        values.push(filters.is_verified);
      }

      const result = await query(
        `SELECT COUNT(DISTINCT t.id) as total 
         FROM therapists t
         LEFT JOIN therapist_profiles tp ON t.id = tp.therapist_id
         ${whereClause}`,
        values
      );
      
      return parseInt(result.rows[0].total);
    } catch (error) {
      console.error('Error getting therapist count:', error);
      throw error;
    }
  }

  // Get therapist specializations
  static async getSpecializations(therapistId) {
    try {
      const result = await query(
        `SELECT s.*, ts.proficiency_level
         FROM specializations s
         JOIN therapist_specializations ts ON s.id = ts.specialization_id
         WHERE ts.therapist_id = $1 AND s.is_active = true
         ORDER BY s.name`,
        [therapistId]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting therapist specializations:', error);
      throw error;
    }
  }

  // Get therapist approaches
  static async getApproaches(therapistId) {
    try {
      const result = await query(
        `SELECT a.*
         FROM therapy_approaches a
         JOIN therapist_approaches ta ON a.id = ta.approach_id
         WHERE ta.therapist_id = $1 AND a.is_active = true
         ORDER BY a.name`,
        [therapistId]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting therapist approaches:', error);
      throw error;
    }
  }

  // Get therapist clients
  static async getClients(therapistId, status = 'active') {
    try {
      const result = await query(
        `SELECT tc.*, tc.user_id, tc.relationship_status, tc.started_date, tc.notes,
                COUNT(sb.id) as total_sessions,
                COUNT(sb.id) FILTER (WHERE sb.status = 'completed') as completed_sessions
         FROM therapist_clients tc
         LEFT JOIN session_bookings sb ON tc.therapist_id = sb.therapist_id AND tc.user_id = sb.user_id
         WHERE tc.therapist_id = $1 AND tc.relationship_status = $2
         GROUP BY tc.id
         ORDER BY tc.started_date DESC`,
        [therapistId, status]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting therapist clients:', error);
      throw error;
    }
  }

  // Get therapist stats (admin only)
  static async getStats() {
    try {
      const result = await query(
        `SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE verification_status = 'verified') as approved,
          COUNT(*) FILTER (WHERE verification_status = 'pending') as pending
         FROM therapists
         WHERE is_active = true`
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error getting therapist stats:', error);
      throw error;
    }
  }

  // Get admin statistics
  static async getAdminStats() {
    try {
      const result = await query(
        `SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE verification_status = 'verified') as verified,
          COUNT(*) FILTER (WHERE verification_status = 'pending') as pending
         FROM therapists
         WHERE is_active = true`
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error getting admin stats:', error);
      throw error;
    }
  }
}

module.exports = Therapist;