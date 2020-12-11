const express = require('express');
const middleware = require('../middleware');
const classHandlers = require('../handlers/class');
const opentokHandlers = require('../handlers/opentok');
const stripeHandlers = require('../handlers/stripe');
const feedbackHandlers = require('../handlers/feedback');
const subscriptionHandlers = require('../handlers/stripe/subscription');

let router = express.Router();

// Get a list of classes. Will return 50 results at a time by default. 
router.get('/', classHandlers.getClasses);

// Create a class. Only allowed for Admins and Instructors
router.post('/', middleware.authentication);
router.post('/', middleware.adminOrInstructorAuthorized);
router.post('/', classHandlers.createClass);

// Get class details
router.get('/:id', classHandlers.getClass);

// Delete a class. Only works if the class has no participants
router.delete('/:id', middleware.authentication);
router.delete('/:id', middleware.adminOrInstructorAuthorized);
router.delete('/:id', classHandlers.deleteClass);

// Update a class
router.put('/:id', middleware.authentication);
router.put('/:id', middleware.adminOrInstructorAuthorized);
router.put('/:id', classHandlers.updateClass);

router.post('/:id/feedback/:sessionId', middleware.authentication);
router.post('/:id/feedback/:sessionId', feedbackHandlers.post);

// Old add user to class route
router.post('/:id/payment/:payment_method_id', middleware.authentication);
router.post('/:id/payment/:payment_method_id', stripeHandlers.transaction.create);

// New subscription based add user to class route
router.post('/:id/participants', middleware.authentication);
router.post('/:id/participants', subscriptionHandlers.addUserToClass);

router.post('/:id/payment/:payment_method_id/campaign/:campaignId', middleware.authentication);
router.post('/:id/payment/:payment_method_id/campaign/:campaignId', stripeHandlers.transaction.create);

router.delete('/:id/payment/', middleware.authentication);
router.delete('/:id/payment/', stripeHandlers.transaction.refund);

router.get('/:id/session', middleware.authentication);
router.get('/:id/session', opentokHandlers.joinSession);

router.post('/:id/email', middleware.authentication);
router.post('/:id/email', classHandlers.emailClass);

router.delete('/:id', middleware.authentication);
router.delete('/:id', classHandlers.deleteClass);

router.get('/:id/participants', middleware.authentication);
router.get('/:id/participants', classHandlers.getClassParticipants);

module.exports = router;
