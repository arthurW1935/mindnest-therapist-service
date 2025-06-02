const { query } = require('../config/database');

class TherapistProfile {
  // Create therapist profile
  static async create(therapistId, profileData) {
    try {
      const {
        first_name, last_name, title, bio, years_experience,
        education, certifications, languages_spoken, phone,
        license_number, license_state, session_rate, currency, timezone
      } = profileData;

      const result = await query(
        `INSERT INTO therapist_profiles (
          therapist_id, first_name, last_name, title, bio, years_experience,
          education, certifications, languages_spoken, phone,
          license_number, license_state, session_rate, currency, timezone
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`,
        [
          therapistId, first_name, last_name, title, bio, years_experience,
          education, certifications, languages_spoken, phone,
          license_number, license_state, session_rate, currency, timezone
        ]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error creating therapist profile:', error);
      throw error;
    }
  }

  // Get therapist profile by therapist ID
  static async findByTherapistId(therapistId) {
    try {
      const result = await query(
        `SELECT * FROM therapist_profiles WHERE therapist_id = $1`,
        [therapistId]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error finding therapist profile:', error);
      throw error;
    }
  }

  // Update therapist profile
  static async update(therapistId, profileData) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      // Build dynamic update query
      Object.entries(profileData).forEach(([key, value]) => {
        if (value !== undefined) {
          fields.push(`${key} = $${paramCount++}`);
          values.push(value);
        }
      });

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(therapistId);
      const result = await query(
        `UPDATE therapist_profiles SET ${fields.join(', ')} 
         WHERE therapist_id = $${paramCount} 
         RETURNING *`,
        values
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error updating therapist profile:', error);
      throw error;
    }
  }

  // Create or update therapist profile (upsert)
  static async upsert(therapistId, profileData) {
    try {
      const existing = await this.findByTherapistId(therapistId);
      
      if (existing) {
        return await this.update(therapistId, profileData);
      } else {
        return await this.create(therapistId, profileData);
      }
    } catch (error) {
      console.error('Error upserting therapist profile:', error);
      throw error;
    }
  }

  // Delete therapist profile
  static async delete(therapistId) {
    try {
      const result = await query(
        `DELETE FROM therapist_profiles WHERE therapist_id = $1 RETURNING *`,
        [therapistId]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error deleting therapist profile:', error);
      throw error;
    }
  }

  // Update profile picture
  static async updateProfilePicture(therapistId, pictureUrl) {
    try {
      const result = await query(
        `UPDATE therapist_profiles SET profile_picture_url = $1 
         WHERE therapist_id = $2 
         RETURNING profile_picture_url`,
        [pictureUrl, therapistId]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error updating profile picture:', error);
      throw error;
    }
  }

  // Get profile completion percentage
  static async getCompletionPercentage(therapistId) {
    try {
      const profile = await this.findByTherapistId(therapistId);
      
      if (!profile) {
        return 0;
      }

      const requiredFields = [
        'first_name', 'last_name', 'title', 'bio', 'years_experience',
        'education', 'certifications', 'languages_spoken', 'phone',
        'license_number', 'license_state', 'session_rate'
      ];

      const completedFields = requiredFields.filter(field => {
        const value = profile[field];
        if (Array.isArray(value)) {
          return value && value.length > 0;
        }
        return value !== null && value !== undefined && value.toString().trim() !== '';
      });

      return Math.round((completedFields.length / requiredFields.length) * 100);
    } catch (error) {
      console.error('Error calculating profile completion:', error);
      throw error;
    }
  }

  // Add specializations to therapist
  static async addSpecializations(therapistId, specializationData) {
    try {
      const { specialization_ids, proficiency_levels } = specializationData;
      
      // Remove existing specializations
      await query(
        `DELETE FROM therapist_specializations WHERE therapist_id = $1`,
        [therapistId]
      );

      // Add new specializations
      const insertPromises = specialization_ids.map((specializationId, index) => {
        const proficiencyLevel = proficiency_levels ? proficiency_levels[index] : 'proficient';
        return query(
          `INSERT INTO therapist_specializations (therapist_id, specialization_id, proficiency_level)
           VALUES ($1, $2, $3) RETURNING *`,
          [therapistId, specializationId, proficiencyLevel]
        );
      });

      const results = await Promise.all(insertPromises);
      return results.map(result => result.rows[0]);
    } catch (error) {
      console.error('Error adding therapist specializations:', error);
      throw error;
    }
  }

  // Add approaches to therapist
  static async addApproaches(therapistId, approachIds) {
    try {
      // Remove existing approaches
      await query(
        `DELETE FROM therapist_approaches WHERE therapist_id = $1`,
        [therapistId]
      );

      // Add new approaches
      const insertPromises = approachIds.map(approachId => 
        query(
          `INSERT INTO therapist_approaches (therapist_id, approach_id)
           VALUES ($1, $2) RETURNING *`,
          [therapistId, approachId]
        )
      );

      const results = await Promise.all(insertPromises);
      return results.map(result => result.rows[0]);
    } catch (error) {
      console.error('Error adding therapist approaches:', error);
      throw error;
    }
  }

  // Get available specializations
  static async getAvailableSpecializations() {
    try {
      const result = await query(
        `SELECT * FROM specializations WHERE is_active = true ORDER BY category, name`
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting available specializations:', error);
      throw error;
    }
  }

  // Get available therapy approaches
  static async getAvailableApproaches() {
    try {
      const result = await query(
        `SELECT * FROM therapy_approaches WHERE is_active = true ORDER BY category, name`
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting available approaches:', error);
      throw error;
    }
  }

  // Get therapist's full profile with specializations and approaches
  static async getFullProfile(therapistId) {
    try {
      const profile = await this.findByTherapistId(therapistId);
      if (!profile) {
        return null;
      }

      // Get specializations
      const specializationsResult = await query(
        `SELECT s.*, ts.proficiency_level
         FROM specializations s
         JOIN therapist_specializations ts ON s.id = ts.specialization_id
         WHERE ts.therapist_id = $1 AND s.is_active = true
         ORDER BY s.category, s.name`,
        [therapistId]
      );

      // Get approaches
      const approachesResult = await query(
        `SELECT a.*
         FROM therapy_approaches a
         JOIN therapist_approaches ta ON a.id = ta.approach_id
         WHERE ta.therapist_id = $1 AND a.is_active = true
         ORDER BY a.category, a.name`,
        [therapistId]
      );

      return {
        ...profile,
        specializations: specializationsResult.rows,
        approaches: approachesResult.rows
      };
    } catch (error) {
      console.error('Error getting full therapist profile:', error);
      throw error;
    }
  }
}

module.exports = TherapistProfile;