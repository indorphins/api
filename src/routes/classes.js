const express = require('express');
const middleware = require('../middleware');
const classController = require('../handlers/class');

let router = express.Router();
router.get('/', classController.getClasses);

router.post('/', middleware.authentication);
router.post('/', middleware.adminAuthorized);
router.post('/', middleware.instructorAuthorized);
router.post('/', classController.createClass);

router.get('/:id', classController.getClass);

router.delete('/:id', middleware.authentication);
router.delete('/:id', middleware.adminAuthorized);
router.delete('/:id', middleware.instructorAuthorized);
router.delete('/:id', classController.deleteClass);

router.put('/:id', middleware.authentication);
router.put('/:id', middleware.adminAuthorized);
router.put('/:id', middleware.instructorAuthorized);
router.put('/:id', classController.updateClass);

/*
router.get('/scheduled', classController.getScheduledClasses);
router.get('/end/:id', classController.endClass);
router.get('/cancel/:id', classController.cancelClass);
*/

module.exports = router;
