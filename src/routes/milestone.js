const express = require('express');
const router = express.Router();
const middleware = require('../middleware');
const milestone = require('../handlers/milestone');

router.put('/:id', middleware.authentication);
router.put('/:id', milestone.updateMilestone);

router.get('/', middleware.authentication);
router.get('/', milestone.getMilestone)

module.exports = router;
