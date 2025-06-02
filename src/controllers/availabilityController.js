const Therapist = require('../models/Therapist');
const Availability = require('../models/Availability');
const { logActivity } = require('../utils/activityLogger');

class AvailabilityController {
  // Search available slots (public endpoint)
  static async searchAvailableSlots(req, res) {
    try {
      const {
        therapist_id, start_date, end_date, session_type, duration,
        page = 1, limit = 20
      } = req.query;

      const filters = {
        ...(therapist_id && { therapist_id: parseInt(therapist_id) }),
        ...(start_date && { start_date }),
        ...(end_date && { end_date }),
        ...(session_type && { session_type }),
        ...(duration && { duration: parseInt(duration) })
      };

      const slots = await Availability.findAvailableSlots(filters);
      
      // Apply pagination
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const endIndex = startIndex + parseInt(limit);
      const paginatedSlots = slots.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: {
          slots: paginatedSlots,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: slots.length,
            pages: Math.ceil(slots.length / parseInt(limit))
          }
        }
      });
    } catch (error) {
      console.error('Error searching available slots:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search available slots'
      });
    }
  }

  // Get availability templates
  static async getAvailabilityTemplates(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      const templates = await Availability.getTemplates(therapist.id);

      res.json({
        success: true,
        data: {
          templates
        }
      });
    } catch (error) {
      console.error('Error getting availability templates:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get availability templates'
      });
    }
  }

  // Create availability template
  static async createAvailabilityTemplate(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      const templateData = req.body;
      const template = await Availability.createTemplate(therapist.id, templateData);

      // Log activity
      await logActivity(therapist.id, 'template_created', 'Availability template created', {
        day_of_week: template.day_of_week,
        start_time: template.start_time,
        end_time: template.end_time
      });

      res.status(201).json({
        success: true,
        message: 'Availability template created successfully',
        data: {
          template
        }
      });
    } catch (error) {
      console.error('Error creating availability template:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create availability template'
      });
    }
  }

  // Update availability template
  static async updateAvailabilityTemplate(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);
      const templateId = parseInt(req.params.templateId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      const templateData = req.body;
      const updatedTemplate = await Availability.updateTemplate(templateId, therapist.id, templateData);

      if (!updatedTemplate) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      // Log activity
      await logActivity(therapist.id, 'template_updated', 'Availability template updated', {
        template_id: templateId,
        updated_fields: Object.keys(templateData)
      });

      res.json({
        success: true,
        message: 'Availability template updated successfully',
        data: {
          template: updatedTemplate
        }
      });
    } catch (error) {
      console.error('Error updating availability template:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update availability template'
      });
    }
  }

  // Delete availability template
  static async deleteAvailabilityTemplate(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);
      const templateId = parseInt(req.params.templateId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      const deletedTemplate = await Availability.deleteTemplate(templateId, therapist.id);

      if (!deletedTemplate) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      // Log activity
      await logActivity(therapist.id, 'template_deleted', 'Availability template deleted', {
        template_id: templateId
      });

      res.json({
        success: true,
        message: 'Availability template deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting availability template:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete availability template'
      });
    }
  }

  // Generate slots from template
  static async generateSlotsFromTemplate(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      const { template_id, start_date, end_date, exclude_dates } = req.body;
      const slots = await Availability.generateSlotsFromTemplate(
        template_id, 
        start_date, 
        end_date, 
        exclude_dates || []
      );

      // Log activity
      await logActivity(therapist.id, 'slots_generated', 'Availability slots generated from template', {
        template_id,
        start_date,
        end_date,
        slots_created: slots.length
      });

      res.status(201).json({
        success: true,
        message: `${slots.length} availability slots generated successfully`,
        data: {
          slots
        }
      });
    } catch (error) {
      console.error('Error generating slots from template:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate slots from template'
      });
    }
  }

  // Get availability slots
  static async getAvailabilitySlots(req, res) {
    try {
      const authUserId = req.user.sub;
      const userRole = req.user.role;
      
      let therapistId;
      
      if (userRole === 'psychiatrist') {
        const therapist = await Therapist.findByAuthUserId(authUserId);
        if (!therapist) {
          return res.status(404).json({
            success: false,
            message: 'Therapist not found'
          });
        }
        therapistId = therapist.id;
      } else {
        // For users, require therapist_id in query
        therapistId = parseInt(req.query.therapist_id);
        if (!therapistId) {
          return res.status(400).json({
            success: false,
            message: 'Therapist ID is required'
          });
        }
      }

      const { start_date, end_date, status } = req.query;
      
      if (!start_date || !end_date) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }

      const slots = await Availability.getSlots(therapistId, start_date, end_date, status);

      res.json({
        success: true,
        data: {
          slots
        }
      });
    } catch (error) {
      console.error('Error getting availability slots:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get availability slots'
      });
    }
  }

  // Create availability slot
  static async createAvailabilitySlot(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      const slotData = req.body;
      const slot = await Availability.createSlot(therapist.id, slotData);

      // Log activity
      await logActivity(therapist.id, 'slot_created', 'Availability slot created', {
        start_datetime: slot.start_datetime,
        end_datetime: slot.end_datetime,
        session_type: slot.session_type
      });

      res.status(201).json({
        success: true,
        message: 'Availability slot created successfully',
        data: {
          slot
        }
      });
    } catch (error) {
      console.error('Error creating availability slot:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create availability slot'
      });
    }
  }

  // Update availability slot
  static async updateAvailabilitySlot(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);
      const slotId = parseInt(req.params.slotId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      const slotData = req.body;
      const updatedSlot = await Availability.updateSlot(slotId, therapist.id, slotData);

      if (!updatedSlot) {
        return res.status(404).json({
          success: false,
          message: 'Availability slot not found'
        });
      }

      // Log activity
      await logActivity(therapist.id, 'slot_updated', 'Availability slot updated', {
        slot_id: slotId,
        updated_fields: Object.keys(slotData)
      });

      res.json({
        success: true,
        message: 'Availability slot updated successfully',
        data: {
          slot: updatedSlot
        }
      });
    } catch (error) {
      console.error('Error updating availability slot:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update availability slot'
      });
    }
  }

  // Delete availability slot
  static async deleteAvailabilitySlot(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);
      const slotId = parseInt(req.params.slotId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      const deletedSlot = await Availability.deleteSlot(slotId, therapist.id);

      if (!deletedSlot) {
        return res.status(404).json({
          success: false,
          message: 'Availability slot not found or cannot be deleted'
        });
      }

      // Log activity
      await logActivity(therapist.id, 'slot_deleted', 'Availability slot deleted', {
        slot_id: slotId
      });

      res.json({
        success: true,
        message: 'Availability slot deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting availability slot:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete availability slot'
      });
    }
  }

  // Book availability slot
  static async bookAvailabilitySlot(req, res) {
    try {
      const slotId = parseInt(req.params.slotId);
      const userId = req.user.sub;
      const { session_type, notes } = req.body;

      const bookingResult = await Availability.bookSlot(slotId, userId, {
        session_type,
        notes
      });

      res.status(201).json({
        success: true,
        message: 'Availability slot booked successfully',
        data: {
          slot: bookingResult.slot,
          booking: bookingResult.booking
        }
      });
    } catch (error) {
      console.error('Error booking availability slot:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to book availability slot'
      });
    }
  }

  // Cancel availability slot
  static async cancelAvailabilitySlot(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);
      const slotId = parseInt(req.params.slotId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      const { reason } = req.body;
      const cancelledSlot = await Availability.cancelSlot(slotId, therapist.id, reason);

      if (!cancelledSlot) {
        return res.status(404).json({
          success: false,
          message: 'Availability slot not found'
        });
      }

      // Log activity
      await logActivity(therapist.id, 'slot_cancelled', 'Availability slot cancelled', {
        slot_id: slotId,
        reason
      });

      res.json({
        success: true,
        message: 'Availability slot cancelled successfully',
        data: {
          slot: cancelledSlot
        }
      });
    } catch (error) {
      console.error('Error cancelling availability slot:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel availability slot'
      });
    }
  }

  // Get therapist's calendar view
  static async getTherapistCalendar(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      const { start_date, end_date } = req.query;
      
      if (!start_date || !end_date) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }

      // Get all slots (available, booked, cancelled)
      const allSlots = await Availability.getSlots(therapist.id, start_date, end_date);

      // Group slots by status
      const calendar = {
        available: allSlots.filter(slot => slot.status === 'available'),
        booked: allSlots.filter(slot => slot.status === 'booked'),
        cancelled: allSlots.filter(slot => slot.status === 'cancelled'),
        blocked: allSlots.filter(slot => slot.status === 'blocked')
      };

      // Calculate summary statistics
      const summary = {
        total_slots: allSlots.length,
        available_slots: calendar.available.length,
        booked_slots: calendar.booked.length,
        cancelled_slots: calendar.cancelled.length,
        blocked_slots: calendar.blocked.length,
        utilization_rate: allSlots.length > 0 ? 
          Math.round((calendar.booked.length / (calendar.available.length + calendar.booked.length)) * 100) : 0
      };

      res.json({
        success: true,
        data: {
          calendar,
          summary,
          date_range: {
            start_date,
            end_date
          }
        }
      });
    } catch (error) {
      console.error('Error getting therapist calendar:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get therapist calendar'
      });
    }
  }
}

module.exports = AvailabilityController;