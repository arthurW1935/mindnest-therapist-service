const Therapist = require('../models/Therapist');
const TherapistProfile = require('../models/TherapistProfile');
const { logActivity } = require('../utils/activityLogger');

class ProfileController {
  // Get current therapist's profile
  static async getCurrentTherapistProfile(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      const fullProfile = await TherapistProfile.getFullProfile(therapist.id);
      const completionPercentage = await TherapistProfile.getCompletionPercentage(therapist.id);

      // Generate profile picture URL if name fields are provided
      let profilePictureUrl = null;
      if (fullProfile && (fullProfile.first_name || fullProfile.last_name)) {
        profilePictureUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent((fullProfile.first_name || '') + ' ' + (fullProfile.last_name || '')).trim()}&size=64&background=10B981&color=ffffff`;
      }

      res.json({
        success: true,
        data: {
          profile: {
            ...(fullProfile || {}),
            profile_picture_url: profilePictureUrl
          },
          completion_percentage: completionPercentage
        }
      });
    } catch (error) {
      console.error('Error getting therapist profile:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get profile'
      });
    }
  }

  // Update current therapist's profile
  static async updateCurrentTherapistProfile(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      const profileData = req.body;
      const updatedProfile = await TherapistProfile.upsert(therapist.id, profileData);

      // Generate profile picture URL if name fields are provided
      let profilePictureUrl = null;
      if (updatedProfile.first_name || updatedProfile.last_name) {
        profilePictureUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent((updatedProfile.first_name || '') + ' ' + (updatedProfile.last_name || '')).trim()}&size=64&background=10B981&color=ffffff`;
      }

      // Log activity
      await logActivity(therapist.id, 'profile_update', 'Therapist profile updated', {
        updated_fields: Object.keys(profileData)
      });

      const completionPercentage = await TherapistProfile.getCompletionPercentage(therapist.id);

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          profile: {
            ...updatedProfile,
            profile_picture_url: profilePictureUrl
          },
          completion_percentage: completionPercentage
        }
      });
    } catch (error) {
      console.error('Error updating therapist profile:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile'
      });
    }
  }

  // Get profile completion status
  static async getProfileCompletion(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      const completionPercentage = await TherapistProfile.getCompletionPercentage(therapist.id);
      const profile = await TherapistProfile.findByTherapistId(therapist.id);

      const requiredFields = [
        'first_name', 'last_name', 'title', 'bio', 'years_experience',
        'education', 'certifications', 'languages_spoken', 'phone',
        'license_number', 'license_state', 'session_rate'
      ];

      const missingFields = requiredFields.filter(field => {
        if (!profile) return true;
        const value = profile[field];
        if (Array.isArray(value)) {
          return !value || value.length === 0;
        }
        return !value || value.toString().trim() === '';
      });

      res.json({
        success: true,
        data: {
          completion_percentage: completionPercentage,
          is_complete: completionPercentage === 100,
          missing_fields: missingFields,
          total_required_fields: requiredFields.length,
          completed_fields: requiredFields.length - missingFields.length
        }
      });
    } catch (error) {
      console.error('Error getting profile completion:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get profile completion'
      });
    }
  }

  // Get profile picture URL
  static async getProfilePicture(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      const profile = await TherapistProfile.findByTherapistId(therapist.id);
      const size = parseInt(req.query.size) || 64;
      
      // Validate size (max 128 as per UI Avatars)
      const validSize = Math.min(Math.max(size, 16), 128);
      
      const profilePictureUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent((profile?.first_name || '') + ' ' + (profile?.last_name || '')).trim() || 'Therapist'}&size=${validSize}&background=10B981&color=ffffff`;

      res.json({
        success: true,
        data: {
          profile_picture_url: profilePictureUrl,
          size: validSize
        }
      });
    } catch (error) {
      console.error('Error getting profile picture:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get profile picture'
      });
    }
  }

  // Get therapist specializations
  static async getTherapistSpecializations(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      const specializations = await Therapist.getSpecializations(therapist.id);

      res.json({
        success: true,
        data: {
          specializations
        }
      });
    } catch (error) {
      console.error('Error getting therapist specializations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get specializations'
      });
    }
  }

  // Update therapist specializations
  static async updateTherapistSpecializations(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      const { specialization_ids, proficiency_levels } = req.body;
      const updatedSpecializations = await TherapistProfile.addSpecializations(therapist.id, {
        specialization_ids,
        proficiency_levels
      });

      // Log activity
      await logActivity(therapist.id, 'specializations_update', 'Therapist specializations updated', {
        specialization_ids,
        count: specialization_ids.length
      });

      res.json({
        success: true,
        message: 'Specializations updated successfully',
        data: {
          specializations: updatedSpecializations
        }
      });
    } catch (error) {
      console.error('Error updating therapist specializations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update specializations'
      });
    }
  }

  // Get therapist approaches
  static async getTherapistApproaches(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      const approaches = await Therapist.getApproaches(therapist.id);

      res.json({
        success: true,
        data: {
          approaches
        }
      });
    } catch (error) {
      console.error('Error getting therapist approaches:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get approaches'
      });
    }
  }

  // Update therapist approaches
  static async updateTherapistApproaches(req, res) {
    try {
      const authUserId = req.user.sub;
      const therapist = await Therapist.findByAuthUserId(authUserId);

      if (!therapist) {
        return res.status(404).json({
          success: false,
          message: 'Therapist not found'
        });
      }

      const { approach_ids } = req.body;
      const updatedApproaches = await TherapistProfile.addApproaches(therapist.id, approach_ids);

      // Log activity
      await logActivity(therapist.id, 'approaches_update', 'Therapy approaches updated', {
        approach_ids,
        count: approach_ids.length
      });

      res.json({
        success: true,
        message: 'Approaches updated successfully',
        data: {
          approaches: updatedApproaches
        }
      });
    } catch (error) {
      console.error('Error updating therapist approaches:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update approaches'
      });
    }
  }

  // Get available specializations
  static async getAvailableSpecializations(req, res) {
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
      console.error('Error getting available specializations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get available specializations'
      });
    }
  }

  // Get available therapy approaches
  static async getAvailableApproaches(req, res) {
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
      console.error('Error getting available approaches:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get available approaches'
      });
    }
  }
}

module.exports = ProfileController;