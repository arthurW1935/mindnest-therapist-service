const Joi = require('joi');

// Validation middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => detail.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    req.body = value;
    next();
  };
};

// Therapist creation from auth service schema
const createTherapistSchema = Joi.object({
  auth_user_id: Joi.number().integer().positive().required(),
  email: Joi.string().email().required(),
  verification_status: Joi.string().valid('pending', 'verified', 'rejected').default('pending')
});

// Therapist profile validation schema
const therapistProfileSchema = Joi.object({
  first_name: Joi.string().min(1).max(100).trim(),
  last_name: Joi.string().min(1).max(100).trim(),
  title: Joi.string().max(100).trim(),
  bio: Joi.string().max(2000).trim(),
  years_experience: Joi.number().integer().min(0).max(50),
  education: Joi.array().items(Joi.string().max(200)).max(10),
  certifications: Joi.array().items(Joi.string().max(200)).max(20),
  languages_spoken: Joi.array().items(Joi.string().max(50)).max(10),
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).min(10).max(20),
  license_number: Joi.string().max(100).trim(),
  license_state: Joi.string().max(50).trim(),
  session_rate: Joi.number().precision(2).min(0).max(999999.99),
  currency: Joi.string().length(3).uppercase().default('USD'),
  timezone: Joi.string().max(50)
});

// Availability template schema
const availabilityTemplateSchema = Joi.object({
  day_of_week: Joi.number().integer().min(0).max(6).required(),
  start_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
  end_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
  session_duration: Joi.number().integer().min(15).max(180).default(60),
  break_between_sessions: Joi.number().integer().min(0).max(60).default(15),
  is_active: Joi.boolean().default(true)
});

// Availability slot schema
const availabilitySlotSchema = Joi.object({
  start_datetime: Joi.date().iso().required(),
  end_datetime: Joi.date().iso().required(),
  status: Joi.string().valid('available', 'booked', 'blocked', 'cancelled').default('available'),
  session_type: Joi.string().valid('individual', 'group', 'couples', 'family').default('individual'),
  notes: Joi.string().max(500)
});

// Therapist specializations schema
const therapistSpecializationsSchema = Joi.object({
  specialization_ids: Joi.array().items(
    Joi.number().integer().positive()
  ).min(1).max(10).required(),
  proficiency_levels: Joi.array().items(
    Joi.string().valid('beginner', 'proficient', 'expert')
  ).length(Joi.ref('specialization_ids.length'))
});

// Therapist approaches schema
const therapistApproachesSchema = Joi.object({
  approach_ids: Joi.array().items(
    Joi.number().integer().positive()
  ).min(1).max(10).required()
});

// Client relationship schema
const clientRelationshipSchema = Joi.object({
  user_id: Joi.number().integer().positive().required(),
  relationship_status: Joi.string().valid('active', 'inactive', 'terminated').default('active'),
  notes: Joi.string().max(1000),
  session_rate: Joi.number().precision(2).min(0).max(999999.99),
  currency: Joi.string().length(3).uppercase().default('USD')
});

// Session booking schema
const sessionBookingSchema = Joi.object({
  user_id: Joi.number().integer().positive().required(),
  availability_slot_id: Joi.number().integer().positive().required(),
  session_type: Joi.string().valid('individual', 'group', 'couples', 'family').default('individual'),
  notes: Joi.string().max(500)
});

// Review schema
const reviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
  review_text: Joi.string().max(1000),
  is_anonymous: Joi.boolean().default(false)
});

// Query validation schemas
const searchTherapistsSchema = Joi.object({
  specializations: Joi.array().items(Joi.string()),
  approaches: Joi.array().items(Joi.string()),
  languages: Joi.array().items(Joi.string()),
  min_rating: Joi.number().min(1).max(5),
  max_rate: Joi.number().min(0),
  location: Joi.string(),
  availability_date: Joi.date().iso(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20)
});

// Availability query schema
const availabilityQuerySchema = Joi.object({
  start_date: Joi.date().iso().required(),
  end_date: Joi.date().iso().required(),
  session_type: Joi.string().valid('individual', 'group', 'couples', 'family'),
  duration: Joi.number().integer().min(15).max(180)
});

// Update verification status schema (admin only)
const updateVerificationSchema = Joi.object({
  verification_status: Joi.string().valid('pending', 'verified', 'rejected').required(),
  verification_notes: Joi.string().max(500)
});

// Bulk availability creation schema
const bulkAvailabilitySchema = Joi.object({
  template_id: Joi.number().integer().positive().required(),
  start_date: Joi.date().iso().required(),
  end_date: Joi.date().iso().required(),
  exclude_dates: Joi.array().items(Joi.date().iso()).default([])
});

module.exports = {
  validate,
  createTherapistSchema,
  therapistProfileSchema,
  availabilityTemplateSchema,
  availabilitySlotSchema,
  therapistSpecializationsSchema,
  therapistApproachesSchema,
  clientRelationshipSchema,
  sessionBookingSchema,
  reviewSchema,
  searchTherapistsSchema,
  availabilityQuerySchema,
  updateVerificationSchema,
  bulkAvailabilitySchema
};