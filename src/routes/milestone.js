const express = require('express');
const router = express.Router();
const milestone = require('../handlers/milestone');

router.put('/milestone/:id', milestone.updateMilestone);

module.exports = router;
