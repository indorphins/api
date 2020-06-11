const express = require('express');
const instructor = require('../handlers/instructor');

let router = express.Router();
router.get('/', instructor.getList);
router.get('/:id', instructor.get);

module.exports = router;