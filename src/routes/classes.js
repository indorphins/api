const express = require('express');
const middleware = require('../middleware');
const classController = require('../handlers/class');

let router = express.Router();

// Get a list of classes. Will return 100 results at a time. 
// TODO: Support a number of filter flags to optimize query results.
// TODO: pagination
router.get('/', classController.getClasses);

// Create a class. Only allowed for Admins and Instructors
router.post('/', middleware.authentication);
router.post('/', middleware.adminAuthorized);
router.post('/', middleware.instructorAuthorized);
router.post('/', classController.createClass);

// Get class details
router.get('/:id', classController.getClass);

// Delete a class. Only works if the class has no participants
router.delete('/:id', middleware.authentication);
router.delete('/:id', middleware.adminAuthorized);
router.delete('/:id', classController.deleteClass);

// Update a class
router.put('/:id', middleware.authentication);
router.put('/:id', middleware.adminAuthorized);
router.put('/:id', classController.updateClass);

// Add participant to class
router.post('/:id/participants/:user_id', middleware.authentication);
router.post('/:id/participants/:user_id', middleware.adminAuthorized);
router.post('/:id/participants/:user_id', function(req, res, next) { /** implement middleware to validate the user paid for the class */ next();});
router.post('/:id/participants/:user_id', function(req, res){ /* implement this */ })

// Remove participant from class
router.delete('/:id/participants/:user_id', middleware.authentication);
router.delete('/:id/participants/:user_id', middleware.adminAuthorized);
router.delete('/:id/participants/:user_id', function(req, res){ /* implement this */ })
router.delete('/:id/participants/:user_id', function(req, res){ /* implement this */ })

module.exports = router;
