const Therapist = require('../models/Therapist');
const { query } = require('../config/database');
const { logActivity } = require('../utils/activityLogger');

class ClientController {
  // Get therapist's clients
  static async getTherapistClients(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      const { status = 'active', page = 1, limit = 20 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const clients = await query(
        `SELECT tc.*, 
                COUNT(sb.id) as total_sessions,
                COUNT(sb.id) FILTER (WHERE sb.status = 'completed') as completed_sessions,
                COUNT(sb.id) FILTER (WHERE sb.status = 'scheduled') as upcoming_sessions,
                MAX(sb.created_at) as last_session_date
         FROM therapist_clients tc
         LEFT JOIN session_bookings sb ON tc.therapist_id = sb.therapist_id AND tc.user_id = sb.user_id
         WHERE tc.therapist_id = $1 AND tc.relationship_status = $2
         GROUP BY tc.id
         ORDER BY tc.started_date DESC
         LIMIT $3 OFFSET $4`,
        [therapist.id, status, parseInt(limit), offset]
      );

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) as total FROM therapist_clients 
         WHERE therapist_id = $1 AND relationship_status = $2`,
        [therapist.id, status]
      );

      res.json({
        success: true,
        data: {
          clients: clients.rows,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: parseInt(countResult.rows[0].total),
            pages: Math.ceil(parseInt(countResult.rows[0].total) / parseInt(limit))
          }
        }
      });
    } catch (error) {
      console.error('Error getting therapist clients:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get clients'
      });
    }
  }

  // Create client relationship
  static async createClientRelationship(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      const { user_id, relationship_status = 'active', notes, session_rate, currency = 'USD' } = req.body;

      // Check if relationship already exists
      const existing = await query(
        `SELECT * FROM therapist_clients WHERE therapist_id = $1 AND user_id = $2`,
        [therapist.id, user_id]
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Client relationship already exists'
        });
      }

      const result = await query(
        `INSERT INTO therapist_clients (therapist_id, user_id, relationship_status, notes, session_rate, currency)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [therapist.id, user_id, relationship_status, notes, session_rate, currency]
      );

      // Log activity
      await logActivity(therapist.id, 'client_relationship_created', 'New client relationship created', {
        user_id,
        relationship_status
      });

      res.status(201).json({
        success: true,
        message: 'Client relationship created successfully',
        data: {
          relationship: result.rows[0]
        }
      });
    } catch (error) {
      console.error('Error creating client relationship:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create client relationship'
      });
    }
  }

  // Update client relationship
  static async updateClientRelationship(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);
      const userId = parseInt(req.params.userId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      const { relationship_status, notes, session_rate, currency } = req.body;
      const fields = [];
      const values = [];
      let paramCount = 1;

      if (relationship_status !== undefined) {
        fields.push(`relationship_status = $${paramCount++}`);
        values.push(relationship_status);
        
        if (relationship_status === 'inactive' || relationship_status === 'terminated') {
          fields.push(`ended_date = $${paramCount++}`);
          values.push(new Date().toISOString().split('T')[0]);
        }
      }

      if (notes !== undefined) {
        fields.push(`notes = $${paramCount++}`);
        values.push(notes);
      }

      if (session_rate !== undefined) {
        fields.push(`session_rate = $${paramCount++}`);
        values.push(session_rate);
      }

      if (currency !== undefined) {
        fields.push(`currency = $${paramCount++}`);
        values.push(currency);
      }

      if (fields.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }

      values.push(therapist.id, userId);
      const result = await query(
        `UPDATE therapist_clients SET ${fields.join(', ')} 
         WHERE therapist_id = $${paramCount++} AND user_id = $${paramCount} 
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Client relationship not found'
        });
      }

      // Log activity
      await logActivity(therapist.id, 'client_relationship_updated', 'Client relationship updated', {
        user_id: userId,
        updated_fields: Object.keys(req.body)
      });

      res.json({
        success: true,
        message: 'Client relationship updated successfully',
        data: {
          relationship: result.rows[0]
        }
      });
    } catch (error) {
      console.error('Error updating client relationship:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update client relationship'
      });
    }
  }

  // End client relationship
  static async endClientRelationship(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);
      const userId = parseInt(req.params.userId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      const { reason } = req.body;

      const result = await query(
        `UPDATE therapist_clients 
         SET relationship_status = 'terminated', ended_date = CURRENT_DATE, notes = $3
         WHERE therapist_id = $1 AND user_id = $2 
         RETURNING *`,
        [therapist.id, userId, reason]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Client relationship not found'
        });
      }

      // Cancel any upcoming sessions
      await query(
        `UPDATE session_bookings 
         SET status = 'cancelled' 
         WHERE therapist_id = $1 AND user_id = $2 AND status = 'scheduled'`,
        [therapist.id, userId]
      );

      // Log activity
      await logActivity(therapist.id, 'client_relationship_ended', 'Client relationship terminated', {
        user_id: userId,
        reason
      });

      res.json({
        success: true,
        message: 'Client relationship ended successfully',
        data: {
          relationship: result.rows[0]
        }
      });
    } catch (error) {
      console.error('Error ending client relationship:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to end client relationship'
      });
    }
  }

  // Get client details
  static async getClientDetails(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);
      const userId = parseInt(req.params.userId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      const result = await query(
        `SELECT tc.*,
                COUNT(sb.id) as total_sessions,
                COUNT(sb.id) FILTER (WHERE sb.status = 'completed') as completed_sessions,
                COUNT(sb.id) FILTER (WHERE sb.status = 'scheduled') as upcoming_sessions,
                MAX(sb.created_at) as last_session_date,
                MIN(sb.created_at) as first_session_date
         FROM therapist_clients tc
         LEFT JOIN session_bookings sb ON tc.therapist_id = sb.therapist_id AND tc.user_id = sb.user_id
         WHERE tc.therapist_id = $1 AND tc.user_id = $2
         GROUP BY tc.id`,
        [therapist.id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Client relationship not found'
        });
      }

      res.json({
        success: true,
        data: {
          client: result.rows[0]
        }
      });
    } catch (error) {
      console.error('Error getting client details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get client details'
      });
    }
  }

  // Get client sessions
  static async getClientSessions(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);
      const userId = parseInt(req.params.userId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      const { page = 1, limit = 20, status } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let whereClause = 'WHERE sb.therapist_id = $1 AND sb.user_id = $2';
      const values = [therapist.id, userId];
      let paramCount = 3;

      if (status) {
        whereClause += ` AND sb.status = $${paramCount++}`;
        values.push(status);
      }

      const sessions = await query(
        `SELECT sb.*, ast.start_datetime, ast.end_datetime, ast.session_type
         FROM session_bookings sb
         JOIN availability_slots ast ON sb.availability_slot_id = ast.id
         ${whereClause}
         ORDER BY ast.start_datetime DESC
         LIMIT $${paramCount++} OFFSET $${paramCount}`,
        [...values, parseInt(limit), offset]
      );

      res.json({
        success: true,
        data: {
          sessions: sessions.rows
        }
      });
    } catch (error) {
      console.error('Error getting client sessions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get client sessions'
      });
    }
  }

  // Get client notes (placeholder - in a real app this would be a separate notes system)
  static async getClientNotes(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);
      const userId = parseInt(req.params.userId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      // For now, return the relationship notes
      const result = await query(
        `SELECT notes FROM therapist_clients WHERE therapist_id = $1 AND user_id = $2`,
        [therapist.id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Client relationship not found'
        });
      }

      res.json({
        success: true,
        data: {
          notes: result.rows[0].notes || ''
        }
      });
    } catch (error) {
      console.error('Error getting client notes:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get client notes'
      });
    }
  }

  // Get upcoming sessions (for both therapists and users)
  static async getUpcomingSessions(req, res) {
    try {
      const authUserId = req.user.sub;
      const userRole = req.user.role;
      
      let whereClause;
      let values;

      if (userRole === 'psychiatrist') {
        const therapist = await Therapist.findByAuthUserId(authUserId);
        if (!therapist) {
          return res.status(404).json({
            success: false,
            message: 'Therapist not found'
          });
        }
        whereClause = 'WHERE sb.therapist_id = $1';
        values = [therapist.id];
      } else {
        whereClause = 'WHERE sb.user_id = $1';
        values = [authUserId];
      }

      const sessions = await query(
        `SELECT sb.*, ast.start_datetime, ast.end_datetime, ast.session_type,
                t.id as therapist_id, tp.first_name, tp.last_name, tp.title
         FROM session_bookings sb
         JOIN availability_slots ast ON sb.availability_slot_id = ast.id
         JOIN therapists t ON sb.therapist_id = t.id
         LEFT JOIN therapist_profiles tp ON t.id = tp.therapist_id
         ${whereClause} AND sb.status = 'scheduled' AND ast.start_datetime > NOW()
         ORDER BY ast.start_datetime ASC
         LIMIT 10`,
        values
      );

      res.json({
        success: true,
        data: {
          sessions: sessions.rows
        }
      });
    } catch (error) {
      console.error('Error getting upcoming sessions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get upcoming sessions'
      });
    }
  }

  // Get session history
  static async getSessionHistory(req, res) {
    try {
      const authUserId = req.user.sub;
      const userRole = req.user.role;
      const { page = 1, limit = 20 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      let whereClause;
      let values;

      if (userRole === 'psychiatrist') {
        const therapist = await Therapist.findByAuthUserId(authUserId);
        if (!therapist) {
          return res.status(404).json({
            success: false,
            message: 'Therapist not found'
          });
        }
        whereClause = 'WHERE sb.therapist_id = $1';
        values = [therapist.id];
      } else {
        whereClause = 'WHERE sb.user_id = $1';
        values = [authUserId];
      }

      const sessions = await query(
        `SELECT sb.*, ast.start_datetime, ast.end_datetime, ast.session_type,
                t.id as therapist_id, tp.first_name, tp.last_name, tp.title
         FROM session_bookings sb
         JOIN availability_slots ast ON sb.availability_slot_id = ast.id
         JOIN therapists t ON sb.therapist_id = t.id
         LEFT JOIN therapist_profiles tp ON t.id = tp.therapist_id
         ${whereClause} AND ast.end_datetime < NOW()
         ORDER BY ast.start_datetime DESC
         LIMIT $2 OFFSET $3`,
        [...values, parseInt(limit), offset]
      );

      res.json({
        success: true,
        data: {
          sessions: sessions.rows
        }
      });
    } catch (error) {
      console.error('Error getting session history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get session history'
      });
    }
  }

  // Book session (simplified - uses availability booking)
  static async bookSession(req, res) {
    try {
      const { therapist_id, availability_slot_id, session_type, notes } = req.body;
      const userId = req.user.sub;

      // Check if there's an active relationship
      const relationshipCheck = await query(
        `SELECT * FROM therapist_clients 
         WHERE therapist_id = $1 AND user_id = $2 AND relationship_status = 'active'`,
        [therapist_id, userId]
      );

      // Create relationship if it doesn't exist (for direct booking)
      if (relationshipCheck.rows.length === 0) {
        await query(
          `INSERT INTO therapist_clients (therapist_id, user_id, relationship_status)
           VALUES ($1, $2, 'active')`,
          [therapist_id, userId]
        );
      }

      // Create session booking
      const result = await query(
        `INSERT INTO session_bookings (therapist_id, user_id, availability_slot_id, session_type, notes)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [therapist_id, userId, availability_slot_id, session_type, notes]
      );

      // Update availability slot status
      await query(
        `UPDATE availability_slots SET status = 'booked' WHERE id = $1`,
        [availability_slot_id]
      );

      res.status(201).json({
        success: true,
        message: 'Session booked successfully',
        data: {
          booking: result.rows[0]
        }
      });
    } catch (error) {
      console.error('Error booking session:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to book session'
      });
    }
  }

  // Update session
  static async updateSession(req, res) {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const { notes, status } = req.body;
      const authUserId = req.user.sub;

      const fields = [];
      const values = [];
      let paramCount = 1;

      if (notes !== undefined) {
        fields.push(`notes = $${paramCount++}`);
        values.push(notes);
      }

      if (status !== undefined) {
        fields.push(`status = $${paramCount++}`);
        values.push(status);
      }

      if (fields.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }

      // Add session ID and user/therapist check
      values.push(sessionId);
      const userRole = req.user.role;
      
      let whereClause;
      if (userRole === 'psychiatrist') {
        const therapist = await Therapist.findByAuthUserId(authUserId);
        whereClause = `WHERE id = $${paramCount++} AND therapist_id = $${paramCount}`;
        values.push(therapist.id);
      } else {
        whereClause = `WHERE id = $${paramCount++} AND user_id = $${paramCount}`;
        values.push(authUserId);
      }

      const result = await query(
        `UPDATE session_bookings SET ${fields.join(', ')} ${whereClause} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Session not found or access denied'
        });
      }

      res.json({
        success: true,
        message: 'Session updated successfully',
        data: {
          session: result.rows[0]
        }
      });
    } catch (error) {
      console.error('Error updating session:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update session'
      });
    }
  }

  // Cancel session
  static async cancelSession(req, res) {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const authUserId = req.user.sub;
      const { reason } = req.body;

      const userRole = req.user.role;
      let whereClause;
      let values = [sessionId];

      if (userRole === 'psychiatrist') {
        const therapist = await Therapist.findByAuthUserId(authUserId);
        whereClause = 'WHERE id = $1 AND therapist_id = $2';
        values.push(therapist.id);
      } else {
        whereClause = 'WHERE id = $1 AND user_id = $2';
        values.push(authUserId);
      }

      // Update session status
      const result = await query(
        `UPDATE session_bookings SET status = 'cancelled', notes = COALESCE(notes || ' | ', '') || $3 
         ${whereClause} RETURNING *`,
        [...values.slice(0, -1), reason || 'Session cancelled', values[values.length - 1]]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Session not found or access denied'
        });
      }

      // Update availability slot status back to available
      await query(
        `UPDATE availability_slots SET status = 'available' 
         WHERE id = (SELECT availability_slot_id FROM session_bookings WHERE id = $1)`,
        [sessionId]
      );

      res.json({
        success: true,
        message: 'Session cancelled successfully',
        data: {
          session: result.rows[0]
        }
      });
    } catch (error) {
      console.error('Error cancelling session:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel session'
      });
    }
  }

  // Create therapist review
  static async createTherapistReview(req, res) {
    try {
      const therapistId = parseInt(req.params.therapistId);
      const userId = req.user.sub;
      const { rating, review_text, is_anonymous = false } = req.body;

      // Check if user has had sessions with this therapist
      const sessionCheck = await query(
        `SELECT COUNT(*) as session_count 
         FROM session_bookings sb
         JOIN availability_slots ast ON sb.availability_slot_id = ast.id
         WHERE sb.therapist_id = $1 AND sb.user_id = $2 AND sb.status = 'completed'`,
        [therapistId, userId]
      );

      if (parseInt(sessionCheck.rows[0].session_count) === 0) {
        return res.status(403).json({
          success: false,
          message: 'You can only review therapists you have had completed sessions with'
        });
      }

      // Check if review already exists
      const existingReview = await query(
        `SELECT * FROM therapist_reviews WHERE therapist_id = $1 AND user_id = $2`,
        [therapistId, userId]
      );

      if (existingReview.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'You have already reviewed this therapist'
        });
      }

      const result = await query(
        `INSERT INTO therapist_reviews (therapist_id, user_id, rating, review_text, is_anonymous, is_verified)
         VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
        [therapistId, userId, rating, review_text, is_anonymous]
      );

      res.status(201).json({
        success: true,
        message: 'Review created successfully',
        data: {
          review: result.rows[0]
        }
      });
    } catch (error) {
      console.error('Error creating therapist review:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create review'
      });
    }
  }

  // Update therapist review
  static async updateTherapistReview(req, res) {
    try {
      const reviewId = parseInt(req.params.reviewId);
      const userId = req.user.sub;
      const { rating, review_text, is_anonymous } = req.body;

      const fields = [];
      const values = [];
      let paramCount = 1;

      if (rating !== undefined) {
        fields.push(`rating = ${paramCount++}`);
        values.push(rating);
      }

      if (review_text !== undefined) {
        fields.push(`review_text = ${paramCount++}`);
        values.push(review_text);
      }

      if (is_anonymous !== undefined) {
        fields.push(`is_anonymous = ${paramCount++}`);
        values.push(is_anonymous);
      }

      if (fields.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }

      values.push(reviewId, userId);
      const result = await query(
        `UPDATE therapist_reviews SET ${fields.join(', ')} 
         WHERE id = ${paramCount++} AND user_id = ${paramCount} 
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Review not found or access denied'
        });
      }

      res.json({
        success: true,
        message: 'Review updated successfully',
        data: {
          review: result.rows[0]
        }
      });
    } catch (error) {
      console.error('Error updating therapist review:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update review'
      });
    }
  }

  // Delete therapist review
  static async deleteTherapistReview(req, res) {
    try {
      const reviewId = parseInt(req.params.reviewId);
      const userId = req.user.sub;

      const result = await query(
        `DELETE FROM therapist_reviews WHERE id = $1 AND user_id = $2 RETURNING *`,
        [reviewId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Review not found or access denied'
        });
      }

      res.json({
        success: true,
        message: 'Review deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting therapist review:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete review'
      });
    }
  }

  // Get therapist reviews
  static async getTherapistReviews(req, res) {
    try {
      const therapistId = parseInt(req.params.therapistId);
      const { page = 1, limit = 20, rating_filter } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let whereClause = 'WHERE therapist_id = $1 AND is_public = true';
      const values = [therapistId];
      let paramCount = 2;

      if (rating_filter) {
        whereClause += ` AND rating = ${paramCount++}`;
        values.push(parseInt(rating_filter));
      }

      const reviews = await query(
        `SELECT tr.*, 
                CASE WHEN tr.is_anonymous = true THEN 'Anonymous' 
                     ELSE 'Verified Client' END as reviewer_name
         FROM therapist_reviews tr
         ${whereClause}
         ORDER BY tr.created_at DESC
         LIMIT ${paramCount++} OFFSET ${paramCount}`,
        [...values, parseInt(limit), offset]
      );

      // Get rating distribution
      const ratingStats = await query(
        `SELECT 
           COUNT(*) as total_reviews,
           AVG(rating) as average_rating,
           COUNT(*) FILTER (WHERE rating = 5) as five_star,
           COUNT(*) FILTER (WHERE rating = 4) as four_star,
           COUNT(*) FILTER (WHERE rating = 3) as three_star,
           COUNT(*) FILTER (WHERE rating = 2) as two_star,
           COUNT(*) FILTER (WHERE rating = 1) as one_star
         FROM therapist_reviews 
         WHERE therapist_id = $1 AND is_public = true`,
        [therapistId]
      );

      res.json({
        success: true,
        data: {
          reviews: reviews.rows,
          statistics: {
            ...ratingStats.rows[0],
            average_rating: parseFloat(ratingStats.rows[0].average_rating || 0).toFixed(2)
          },
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: parseInt(ratingStats.rows[0].total_reviews),
            pages: Math.ceil(parseInt(ratingStats.rows[0].total_reviews) / parseInt(limit))
          }
        }
      });
    } catch (error) {
      console.error('Error getting therapist reviews:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get reviews'
      });
    }
  }
}

module.exports = ClientController;