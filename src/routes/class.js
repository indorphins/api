const express = require('express');
const middleware = require('../middleware');
const classHandlers = require('../handlers/class');

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

// Add participant to class
router.post('/:id/participants', middleware.authentication);
router.post('/:id/participants', function(req, res, next) { /** implement middleware to validate the user paid for the class */ next();});
router.post('/:id/participants', classHandlers.addParticipant);

// Remove participant from class
router.delete('/:id/participants', middleware.authentication);
router.delete('/:id/participants', classHandlers.removeParticipant);

module.exports = router;
