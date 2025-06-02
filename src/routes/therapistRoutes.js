const express = require('express');
const router = express.Router();

// Import middleware
const { verifyToken, requireTherapist, requireAuth, requireTherapistSelfAccess, requireAdmin } = require('../middleware/auth');
const { validate, createTherapistSchema, searchTherapistsSchema, updateVerificationSchema } = require('../middleware/validation');

// Import controllers
const TherapistController = require('../controllers/therapistController');

// Public routes (called by auth service)
router.post('/create', validate(createTherapistSchema), TherapistController.createTherapist);

// Public search and discovery routes
router.get('/search', TherapistController.searchTherapists);
router.get('/public/:id', TherapistController.getPublicTherapistProfile);
router.get('/specializations', TherapistController.getSpecializations);
router.get('/approaches', TherapistController.getApproaches);

// Protected routes (require authentication)
router.use(verifyToken);

// Get current therapist info
router.get('/me', requireTherapist, TherapistController.getCurrentTherapist);

// Get therapist by ID (therapist self-access)
router.get('/:id', requireTherapistSelfAccess, TherapistController.getTherapistById);

// Update current therapist
router.put('/me', requireTherapist, TherapistController.updateCurrentTherapist);

// Delete current therapist account
router.delete('/me', requireTherapist, TherapistController.deleteCurrentTherapist);

// Get all therapists (for admin or other therapists)
router.get('/', requireAuth, TherapistController.getAllTherapists);

// Update verification status (admin only)
router.put('/:id/verification', requireAdmin, validate(updateVerificationSchema), TherapistController.updateVerificationStatus);

// Get therapist statistics
router.get('/me/stats', requireTherapist, TherapistController.getTherapistStats);

// Admin routes
router.get('/admin/stats', requireAdmin, TherapistController.getAdminStats);

module.exports = router;