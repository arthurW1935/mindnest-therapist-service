const express = require('express');
const router = express.Router();

// Import middleware
const { verifyToken, requireTherapist, requireAuth, requireClientAccess } = require('../middleware/auth');
const { validate, clientRelationshipSchema, sessionBookingSchema, reviewSchema } = require('../middleware/validation');

// Import controllers
const ClientController = require('../controllers/clientController');

// All routes require authentication
router.use(verifyToken);

// Therapist's client management
router.get('/me', requireTherapist, ClientController.getTherapistClients);
router.post('/relationship', requireTherapist, validate(clientRelationshipSchema), ClientController.createClientRelationship);
router.put('/relationship/:userId', requireTherapist, validate(clientRelationshipSchema), ClientController.updateClientRelationship);
router.delete('/relationship/:userId', requireTherapist, ClientController.endClientRelationship);

// Get specific client details (therapist access only)
router.get('/:userId', requireTherapist, ClientController.getClientDetails);
router.get('/:userId/sessions', requireTherapist, ClientController.getClientSessions);
router.get('/:userId/notes', requireTherapist, ClientController.getClientNotes);

// Session booking management
router.get('/sessions/upcoming', requireAuth, ClientController.getUpcomingSessions);
router.get('/sessions/history', requireAuth, ClientController.getSessionHistory);
router.post('/sessions/book', requireAuth, validate(sessionBookingSchema), ClientController.bookSession);
router.put('/sessions/:sessionId', requireAuth, ClientController.updateSession);
router.delete('/sessions/:sessionId', requireAuth, ClientController.cancelSession);

// Review and rating system
router.post('/:therapistId/review', requireAuth, validate(reviewSchema), ClientController.createTherapistReview);
router.put('/reviews/:reviewId', requireAuth, validate(reviewSchema), ClientController.updateTherapistReview);
router.delete('/reviews/:reviewId', requireAuth, ClientController.deleteTherapistReview);

// Get reviews for a therapist (public)
router.get('/:therapistId/reviews', ClientController.getTherapistReviews);

module.exports = router;