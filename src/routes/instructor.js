const express = require('express');
const instructor = require('../handlers/instructor');
const middleware = require('../middleware');

let router = express.Router();
router.get('/', instructor.getList);
router.get('/:id', instructor.get);

router.get('/participants/unique', middleware.authentication);
router.get('/participants/unique', instructor.uniqueParticipants);

module.exports = router;