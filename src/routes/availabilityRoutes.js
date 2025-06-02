const express = require('express');
const router = express.Router();

// Import middleware
const { verifyToken, requireTherapist, requireAuth } = require('../middleware/auth');
const { validate, availabilityTemplateSchema, availabilitySlotSchema, bulkAvailabilitySchema, availabilityQuerySchema } = require('../middleware/validation');

// Import controllers
const AvailabilityController = require('../controllers/AvailabilityController');

// Public routes (for users to search available slots)
router.get('/search', AvailabilityController.searchAvailableSlots);

// Protected routes require authentication
router.use(verifyToken);

// Availability Templates (therapist only)
router.get('/templates', requireTherapist, AvailabilityController.getAvailabilityTemplates);
router.post('/templates', requireTherapist, validate(availabilityTemplateSchema), AvailabilityController.createAvailabilityTemplate);
router.put('/templates/:templateId', requireTherapist, validate(availabilityTemplateSchema), AvailabilityController.updateAvailabilityTemplate);
router.delete('/templates/:templateId', requireTherapist, AvailabilityController.deleteAvailabilityTemplate);

// Generate slots from templates
router.post('/generate', requireTherapist, validate(bulkAvailabilitySchema), AvailabilityController.generateSlotsFromTemplate);

// Availability Slots Management
router.get('/slots', requireAuth, AvailabilityController.getAvailabilitySlots);
router.post('/slots', requireTherapist, validate(availabilitySlotSchema), AvailabilityController.createAvailabilitySlot);
router.put('/slots/:slotId', requireTherapist, validate(availabilitySlotSchema), AvailabilityController.updateAvailabilitySlot);
router.delete('/slots/:slotId', requireTherapist, AvailabilityController.deleteAvailabilitySlot);

// Booking management
router.post('/slots/:slotId/book', requireAuth, AvailabilityController.bookAvailabilitySlot);
router.post('/slots/:slotId/cancel', requireTherapist, AvailabilityController.cancelAvailabilitySlot);

// Get therapist's calendar view
router.get('/calendar', requireTherapist, AvailabilityController.getTherapistCalendar);

module.exports = router;