const express = require('express');
const router = express.Router();

// Import middleware
const { verifyToken, requireTherapist } = require('../middleware/auth');
const { validate, therapistProfileSchema, therapistSpecializationsSchema, therapistApproachesSchema } = require('../middleware/validation');

// Import controllers
const ProfileController = require('../controllers/ProfileController');

// All routes require therapist authentication
router.use(verifyToken);
router.use(requireTherapist);

// Get current therapist's profile
router.get('/me', ProfileController.getCurrentTherapistProfile);

// Create or update current therapist's profile
router.put('/me', validate(therapistProfileSchema), ProfileController.updateCurrentTherapistProfile);

// Get profile completion status
router.get('/me/completion', ProfileController.getProfileCompletion);

// Get profile picture URL
router.get('/me/picture', ProfileController.getProfilePicture);

// Specializations management
router.get('/me/specializations', ProfileController.getTherapistSpecializations);
router.post('/me/specializations', validate(therapistSpecializationsSchema), ProfileController.updateTherapistSpecializations);

// Approaches management
router.get('/me/approaches', ProfileController.getTherapistApproaches);
router.post('/me/approaches', validate(therapistApproachesSchema), ProfileController.updateTherapistApproaches);

// Get available specializations and approaches (for dropdowns)
router.get('/specializations/available', ProfileController.getAvailableSpecializations);
router.get('/approaches/available', ProfileController.getAvailableApproaches);

module.exports = router;