const express = require('express');
const middleware = require('../middleware');
const classHandlers = require('../handlers/class');
const opentokHandlers = require('../handlers/opentok');
const stripeHandlers = require('../handlers/stripe');
const stripeSubscription = require('../handlers/subscription');

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

router.post('/:id/payment/:payment_id', middleware.authentication);
router.post('/:id/payment/:payment_id', stripeHandlers.createPayment);

router.delete('/:id/payment/:payment_id', middleware.authentication);
router.delete('/:id/payment/:payment_id', stripeHandlers.refundCharge);

router.post('/:id/subscription', middleware.authentication);
router.post('/:id/subscription', stripeSubscription.create);

router.delete('/:id/subscription', middleware.authentication);
router.delete('/:id/subscription', stripeSubscription.cancel);

// Add participant to class
router.post('/:id/participants', middleware.authentication);
router.post('/:id/participants', classHandlers.addParticipant);

router.post('/:id/participants/:user_id', middleware.authentication);
router.post('/:id/participants/:user_id', middleware.adminAuthorized);
router.post('/:id/participants/:user_id', classHandlers.addParticipant);

// Remove participant from class
router.delete('/:id/participants', middleware.authentication);
router.delete('/:id/participants', classHandlers.removeParticipant);

router.delete('/:id/participants/:user_id', middleware.authentication);
router.delete('/:id/participants/:user_id', middleware.adminAuthorized);
router.delete('/:id/participants/:user_id', classHandlers.removeParticipant);

router.get('/:id/session', middleware.authentication);
router.get('/:id/session', opentokHandlers.joinSession);

module.exports = router;
