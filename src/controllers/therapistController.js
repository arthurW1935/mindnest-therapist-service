const Therapist = require('../models/Therapist');
const TherapistProfile = require('../models/TherapistProfile');
const { logActivity } = require('../utils/activityLogger');

class TherapistController {
  // Create new therapist (called by auth service)
  static async createTherapist(req, res) {
    try {
      const { auth_user_id, email, verification_status } = req.body;

      // Check if therapist already exists
      const existingTherapist = await Therapist.findByAuthUserId(auth_user_id);
      if (existingTherapist) {
        return res.status(409).json({
          success: false,
          message: 'Therapist already exists'
        });
      }

      // Create therapist
      const therapist = await Therapist.create({ 
        auth_user_id, 
        email, 
        verification_status: verification_status || 'pending' 
      });

      // Log activity
      await logActivity(therapist.id, 'therapist_created', 'Therapist account created', {
        email,
        verification_status: therapist.verification_status
      });

      res.status(201).json({
        success: true,
        message: 'Therapist created successfully',
        data: {
          therapist: {
            id: therapist.id,
            auth_user_id: therapist.auth_user_id,
            email: therapist.email,
            is_active: therapist.is_active,
            is_verified: therapist.is_verified,
            verification_status: therapist.verification_status,
            created_at: therapist.created_at
          }
        }
      });
    } catch (error) {
      console.error('Error creating therapist:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create therapist'
      });
    }
  }

  // Get current therapist info
  static async getCurrentTherapist(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      // Get profile completion percentage
      const completionPercentage = await TherapistProfile.getCompletionPercentage(therapist.id);

      // Get specializations and approaches
      const specializations = await Therapist.getSpecializations(therapist.id);
      const approaches = await Therapist.getApproaches(therapist.id);

      res.json({
        success: true,
        data: {
          therapist: {
            id: therapist.id,
            auth_user_id: therapist.auth_user_id,
            email: therapist.email,
            is_active: therapist.is_active,
            is_verified: therapist.is_verified,
            verification_status: therapist.verification_status,
            first_name: therapist.first_name,
            last_name: therapist.last_name,
            title: therapist.title,
            bio: therapist.bio,
            years_experience: therapist.years_experience,
            session_rate: therapist.session_rate,
            currency: therapist.currency,
            average_rating: therapist.average_rating,
            review_count: therapist.review_count,
            profile_completion: completionPercentage,
            specializations,
            approaches,
            created_at: therapist.created_at,
            updated_at: therapist.updated_at
          }
        }
      });
    } catch (error) {
      console.error('Error getting current therapist:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get therapist information'
      });
    }
  }

  // Get therapist by ID
  static async getTherapistById(req, res) {
    try {
      const therapistId = parseInt(req.params.id);
      const therapist = await Therapist.findById(therapistId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      // Verify therapist access (self-access only)
      const authUserId = req.user.sub;
      if (therapist.auth_user_id !== authUserId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only access your own data'
        });
      }

      // Get profile completion percentage
      const completionPercentage = await TherapistProfile.getCompletionPercentage(therapist.id);

      // Get specializations and approaches
      const specializations = await Therapist.getSpecializations(therapist.id);
      const approaches = await Therapist.getApproaches(therapist.id);

      res.json({
        success: true,
        data: {
          therapist: {
            ...therapist,
            profile_completion: completionPercentage,
            specializations,
            approaches
          }
        }
      });
    } catch (error) {
      console.error('Error getting therapist by ID:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get therapist information'
      });
    }
  }

  // Get public therapist profile (for users browsing)
  static async getPublicTherapistProfile(req, res) {
    try {
      const therapistId = parseInt(req.params.id);
      const therapist = await Therapist.findById(therapistId);

      if (!therapist || !therapist.is_verified) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found or not verified'
        });
      }

      // Get specializations and approaches
      const specializations = await Therapist.getSpecializations(therapist.id);
      const approaches = await Therapist.getApproaches(therapist.id);

      // Return only public information
      res.json({
        success: true,
        data: {
          therapist: {
            id: therapist.id,
            first_name: therapist.first_name,
            last_name: therapist.last_name,
            title: therapist.title,
            bio: therapist.bio,
            years_experience: therapist.years_experience,
            education: therapist.education,
            certifications: therapist.certifications,
            languages_spoken: therapist.languages_spoken,
            session_rate: therapist.session_rate,
            currency: therapist.currency,
            timezone: therapist.timezone,
            average_rating: therapist.average_rating,
            review_count: therapist.review_count,
            profile_picture_url: therapist.profile_picture_url || 
              `https://ui-avatars.com/api/?name=${encodeURIComponent((therapist.first_name || '') + ' ' + (therapist.last_name || '')).trim() || 'Therapist'}&size=64&background=10B981&color=ffffff`,
            specializations,
            approaches,
            is_verified: therapist.is_verified
          }
        }
      });
    } catch (error) {
      console.error('Error getting public therapist profile:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get therapist profile'
      });
    }
  }

  // Search therapists (public endpoint)
  static async searchTherapists(req, res) {
    try {
      const {
        specializations, approaches, languages, min_rating, max_rate,
        location, availability_date, page = 1, limit = 20, sort_by, search
      } = req.query;

      const filters = {
        is_verified: true, // Only show verified therapists
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        sort_by
      };

      if (specializations) {
        filters.specializations = Array.isArray(specializations) ? specializations : [specializations];
      }

      if (approaches) {
        filters.approaches = Array.isArray(approaches) ? approaches : [approaches];
      }

      if (languages) {
        filters.languages = Array.isArray(languages) ? languages : [languages];
      }

      if (min_rating) {
        filters.min_rating = parseFloat(min_rating);
      }

      if (max_rate) {
        filters.max_rate = parseFloat(max_rate);
      }

      if (search) {
        filters.search = search;
      }

      const therapists = await Therapist.findAll(filters);
      const total = await Therapist.getCount(filters);

      // Add profile pictures using UI Avatars
      const therapistsWithAvatars = therapists.map(therapist => ({
        ...therapist,
        profile_picture_url: therapist.profile_picture_url || 
          `https://ui-avatars.com/api/?name=${encodeURIComponent((therapist.first_name || '') + ' ' + (therapist.last_name || '')).trim() || 'Therapist'}&size=64&background=10B981&color=ffffff`
      }));

      res.json({
        success: true,
        data: {
          therapists: therapistsWithAvatars,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      });
    } catch (error) {
      console.error('Error searching therapists:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search therapists'
      });
    }
  }

  // Update current therapist basic info
  static async updateCurrentTherapist(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      const { email } = req.body;
      const updateData = {};

      if (email && email !== therapist.email) {
        updateData.email = email;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid fields to update'
        });
      }

      const updatedTherapist = await Therapist.update(therapist.id, updateData);

      // Log activity
      await logActivity(therapist.id, 'therapist_updated', 'Basic therapist information updated', {
        updated_fields: Object.keys(updateData)
      });

      res.json({
        success: true,
        message: 'Therapist updated successfully',
        data: {
          therapist: {
            id: updatedTherapist.id,
            auth_user_id: updatedTherapist.auth_user_id,
            email: updatedTherapist.email,
            is_active: updatedTherapist.is_active,
            is_verified: updatedTherapist.is_verified,
            verification_status: updatedTherapist.verification_status,
            updated_at: updatedTherapist.updated_at
          }
        }
      });
    } catch (error) {
      console.error('Error updating therapist:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update therapist'
      });
    }
  }

  // Delete current therapist account (soft delete)
  static async deleteCurrentTherapist(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      await Therapist.delete(therapist.id);

      // Log activity
      await logActivity(therapist.id, 'therapist_deleted', 'Therapist account deactivated', {
        deactivated_at: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Therapist account deactivated successfully'
      });
    } catch (error) {
      console.error('Error deleting therapist:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete therapist account'
      });
    }
  }

  // Get all therapists (for admin or other therapists)
  static async getAllTherapists(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';
      const verification_status = req.query.verification_status || '';

      const filters = {
        limit,
        offset,
        ...(search && { search }),
        ...(verification_status && { verification_status })
      };

      const therapists = await Therapist.findAll(filters);
      const total = await Therapist.getCount(filters);

      res.json({
        success: true,
        data: {
          therapists,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      console.error('Error getting all therapists:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get therapists'
      });
    }
  }

  // Update verification status (admin functionality)
  static async updateVerificationStatus(req, res) {
    try {
      const therapistId = parseInt(req.params.id);
      const { verification_status, verification_notes } = req.body;

      // Note: In a real app, you'd check if the user has admin permissions
      // For now, any authenticated user can update verification status

      const updatedTherapist = await Therapist.update(therapistId, {
        verification_status,
        verification_notes
      });

      if (!updatedTherapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      // Log activity
      await logActivity(therapistId, 'verification_status_updated', 'Verification status updated', {
        verification_status,
        verification_notes,
        updated_by: req.user.sub
      });

      res.json({
        success: true,
        message: 'Verification status updated successfully',
        data: {
          therapist: updatedTherapist
        }
      });
    } catch (error) {
      console.error('Error updating verification status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update verification status'
      });
    }
  }

  // Get available specializations
  static async getSpecializations(req, res) {
    try {
      const specializations = await TherapistProfile.getAvailableSpecializations();

      // Group by category
      const groupedSpecializations = specializations.reduce((acc, spec) => {
        const category = spec.category || 'other';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(spec);
        return acc;
      }, {});

      res.json({
        success: true,
        data: {
          specializations: groupedSpecializations,
          all: specializations
        }
      });
    } catch (error) {
      console.error('Error getting specializations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get specializations'
      });
    }
  }

  // Get available therapy approaches
  static async getApproaches(req, res) {
    try {
      const approaches = await TherapistProfile.getAvailableApproaches();

      // Group by category
      const groupedApproaches = approaches.reduce((acc, approach) => {
        const category = approach.category || 'other';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(approach);
        return acc;
      }, {});

      res.json({
        success: true,
        data: {
          approaches: groupedApproaches,
          all: approaches
        }
      });
    } catch (error) {
      console.error('Error getting therapy approaches:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get therapy approaches'
      });
    }
  }

  // Get therapist statistics
  static async getTherapistStats(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      // Get clients
      const activeClients = await Therapist.getClients(therapist.id, 'active');
      const inactiveClients = await Therapist.getClients(therapist.id, 'inactive');

      // Get profile completion
      const profileCompletion = await TherapistProfile.getCompletionPercentage(therapist.id);

      // Basic stats (in a real app, you'd calculate these from session_bookings)
      const stats = {
        profile_completion: profileCompletion,
        total_clients: activeClients.length + inactiveClients.length,
        active_clients: activeClients.length,
        inactive_clients: inactiveClients.length,
        total_sessions: 0, // Would be calculated from session_bookings
        completed_sessions: 0, // Would be calculated from session_bookings
        upcoming_sessions: 0, // Would be calculated from session_bookings
        average_rating: therapist.average_rating || 0,
        total_reviews: therapist.review_count || 0,
        is_verified: therapist.is_verified,
        verification_status: therapist.verification_status,
        member_since: therapist.created_at
      };

      res.json({
        success: true,
        data: {
          stats
        }
      });
    } catch (error) {
      console.error('Error getting therapist stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get therapist statistics'
      });
    }
  }

  // Get therapist statistics for admin
  static async getAdminStats(req, res) {
    try {
      const stats = await Therapist.getAdminStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting admin stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get therapist statistics'
      });
    }
  }
}

module.exports = TherapistController;