const { query } = require('../config/database');

class Availability {
  // Create availability template (recurring schedule)
  static async createTemplate(therapistId, templateData) {
    try {
      const {
        day_of_week, start_time, end_time, session_duration = 60,
        break_between_sessions = 15, is_active = true
      } = templateData;

      const result = await query(
        `INSERT INTO availability_templates (
          therapist_id, day_of_week, start_time, end_time,
          session_duration, break_between_sessions, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [therapistId, day_of_week, start_time, end_time, session_duration, break_between_sessions, is_active]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error creating availability template:', error);
      throw error;
    }
  }

  // Get availability templates for therapist
  static async getTemplates(therapistId) {
    try {
      const result = await query(
        `SELECT * FROM availability_templates 
         WHERE therapist_id = $1 AND is_active = true 
         ORDER BY day_of_week, start_time`,
        [therapistId]
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting availability templates:', error);
      throw error;
    }
  }

  // Update availability template
  static async updateTemplate(templateId, therapistId, templateData) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      Object.entries(templateData).forEach(([key, value]) => {
        if (value !== undefined) {
          fields.push(`${key} = $${paramCount++}`);
          values.push(value);
        }
      });

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(templateId, therapistId);
      const result = await query(
        `UPDATE availability_templates SET ${fields.join(', ')} 
         WHERE id = $${paramCount++} AND therapist_id = $${paramCount} 
         RETURNING *`,
        values
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error updating availability template:', error);
      throw error;
    }
  }

  // Delete availability template
  static async deleteTemplate(templateId, therapistId) {
    try {
      const result = await query(
        `UPDATE availability_templates SET is_active = false 
         WHERE id = $1 AND therapist_id = $2 RETURNING *`,
        [templateId, therapistId]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error deleting availability template:', error);
      throw error;
    }
  }

  // Create specific availability slot
  static async createSlot(therapistId, slotData) {
    try {
      const {
        start_datetime, end_datetime, status = 'available',
        session_type = 'individual', notes
      } = slotData;

      const result = await query(
        `INSERT INTO availability_slots (
          therapist_id, start_datetime, end_datetime, status, session_type, notes
        ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [therapistId, start_datetime, end_datetime, status, session_type, notes]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error creating availability slot:', error);
      throw error;
    }
  }

  // Get availability slots for therapist within date range
  static async getSlots(therapistId, startDate, endDate, status = null) {
    try {
      let whereClause = `WHERE therapist_id = $1 AND start_datetime >= $2 AND end_datetime <= $3`;
      const values = [therapistId, startDate, endDate];
      let paramCount = 4;

      if (status) {
        whereClause += ` AND status = $${paramCount++}`;
        values.push(status);
      }

      const result = await query(
        `SELECT * FROM availability_slots 
         ${whereClause}
         ORDER BY start_datetime`,
        values
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting availability slots:', error);
      throw error;
    }
  }

  // Update availability slot
  static async updateSlot(slotId, therapistId, slotData) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      Object.entries(slotData).forEach(([key, value]) => {
        if (value !== undefined) {
          fields.push(`${key} = $${paramCount++}`);
          values.push(value);
        }
      });

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(slotId, therapistId);
      const result = await query(
        `UPDATE availability_slots SET ${fields.join(', ')} 
         WHERE id = $${paramCount++} AND therapist_id = $${paramCount} 
         RETURNING *`,
        values
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error updating availability slot:', error);
      throw error;
    }
  }

  // Delete availability slot
  static async deleteSlot(slotId, therapistId) {
    try {
      const result = await query(
        `DELETE FROM availability_slots 
         WHERE id = $1 AND therapist_id = $2 AND status = 'available' 
         RETURNING *`,
        [slotId, therapistId]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error deleting availability slot:', error);
      throw error;
    }
  }

  // Generate slots from template for date range
  static async generateSlotsFromTemplate(templateId, startDate, endDate, excludeDates = []) {
    try {
      // Get template details
      const templateResult = await query(
        `SELECT * FROM availability_templates WHERE id = $1 AND is_active = true`,
        [templateId]
      );

      if (templateResult.rows.length === 0) {
        throw new Error('Template not found');
      }

      const template = templateResult.rows[0];
      const slots = [];

      // Generate slots for each matching day in the date range
      const currentDate = new Date(startDate);
      const endDateTime = new Date(endDate);

      while (currentDate <= endDateTime) {
        // Check if current date matches template day_of_week (0 = Sunday, 6 = Saturday)
        if (currentDate.getDay() === template.day_of_week) {
          const dateStr = currentDate.toISOString().split('T')[0];
          
          // Skip if date is in exclude list
          if (!excludeDates.includes(dateStr)) {
            // Generate time slots for this day
            const daySlots = this.generateTimeSlotsForDay(
              dateStr,
              template.start_time,
              template.end_time,
              template.session_duration,
              template.break_between_sessions
            );

            // Create slots in database
            for (const slotData of daySlots) {
              const slot = await this.createSlot(template.therapist_id, {
                start_datetime: slotData.start_datetime,
                end_datetime: slotData.end_datetime,
                status: 'available',
                session_type: 'individual'
              });
              slots.push(slot);
            }
          }
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return slots;
    } catch (error) {
      console.error('Error generating slots from template:', error);
      throw error;
    }
  }

  // Helper method to generate time slots for a specific day
  static generateTimeSlotsForDay(date, startTime, endTime, sessionDuration, breakTime) {
    const slots = [];
    
    // Parse times
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    // Create start and end datetime objects
    let currentTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);
    
    while (currentTime < endDateTime) {
      // Calculate slot end time
      const slotEnd = new Date(currentTime.getTime() + (sessionDuration * 60000));
      
      // Check if slot fits within available time
      if (slotEnd <= endDateTime) {
        slots.push({
          start_datetime: new Date(currentTime),
          end_datetime: slotEnd
        });
        
        // Move to next slot (session + break)
        currentTime = new Date(slotEnd.getTime() + (breakTime * 60000));
      } else {
        break;
      }
    }
    
    return slots;
  }

  // Find available slots for booking
  static async findAvailableSlots(filters = {}) {
    try {
      let whereClause = `WHERE status = 'available' AND start_datetime > NOW()`;
      const values = [];
      let paramCount = 1;

      if (filters.therapist_id) {
        whereClause += ` AND therapist_id = $${paramCount++}`;
        values.push(filters.therapist_id);
      }

      if (filters.start_date) {
        whereClause += ` AND start_datetime >= $${paramCount++}`;
        values.push(filters.start_date);
      }

      if (filters.end_date) {
        whereClause += ` AND end_datetime <= $${paramCount++}`;
        values.push(filters.end_date);
      }

      if (filters.session_type) {
        whereClause += ` AND session_type = $${paramCount++}`;
        values.push(filters.session_type);
      }

      if (filters.duration) {
        whereClause += ` AND EXTRACT(EPOCH FROM (end_datetime - start_datetime))/60 >= $${paramCount++}`;
        values.push(filters.duration);
      }

      const result = await query(
        `SELECT ast.*, t.id as therapist_id, 
                tp.first_name, tp.last_name, tp.session_rate, tp.currency
         FROM availability_slots ast
         JOIN therapists t ON ast.therapist_id = t.id
         LEFT JOIN therapist_profiles tp ON t.id = tp.therapist_id
         ${whereClause}
         ORDER BY ast.start_datetime`,
        values
      );

      return result.rows;
    } catch (error) {
      console.error('Error finding available slots:', error);
      throw error;
    }
  }

  // Book an availability slot
  static async bookSlot(slotId, userId, sessionData = {}) {
    try {
      // First, check if slot is available
      const slotResult = await query(
        `SELECT * FROM availability_slots 
         WHERE id = $1 AND status = 'available'`,
        [slotId]
      );

      if (slotResult.rows.length === 0) {
        throw new Error('Availability slot not found or not available');
      }

      const slot = slotResult.rows[0];

      // Update slot status to booked
      await query(
        `UPDATE availability_slots SET status = 'booked' WHERE id = $1`,
        [slotId]
      );

      // Create session booking
      const bookingResult = await query(
        `INSERT INTO session_bookings (
          therapist_id, user_id, availability_slot_id, session_type, notes
        ) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [
          slot.therapist_id,
          userId,
          slotId,
          sessionData.session_type || 'individual',
          sessionData.notes || null
        ]
      );

      return {
        slot: { ...slot, status: 'booked' },
        booking: bookingResult.rows[0]
      };
    } catch (error) {
      console.error('Error booking availability slot:', error);
      throw error;
    }
  }

  // Cancel a booked slot
  static async cancelSlot(slotId, therapistId, reason = null) {
    try {
      // Update slot status
      const result = await query(
        `UPDATE availability_slots 
         SET status = 'cancelled', notes = $3
         WHERE id = $1 AND therapist_id = $2 
         RETURNING *`,
        [slotId, therapistId, reason]
      );

      // Update associated booking
      await query(
        `UPDATE session_bookings 
         SET status = 'cancelled' 
         WHERE availability_slot_id = $1`,
        [slotId]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error cancelling availability slot:', error);
      throw error;
    }
  }

  // Clean up expired slots
  static async cleanupExpiredSlots() {
    try {
      const result = await query(
        `DELETE FROM availability_slots 
         WHERE status = 'available' AND end_datetime < NOW() - INTERVAL '1 hour'
         RETURNING id`
      );

      console.log(`🧹 Cleaned up ${result.rowCount} expired availability slots`);
      return result.rowCount;
    } catch (error) {
      console.error('Error cleaning up expired slots:', error);
      throw error;
    }
  }
}

module.exports = Availability;