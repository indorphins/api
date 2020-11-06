const express = require('express');
const router = express.Router();
const middleware = require('../middleware');
const reportHandlers = require('../handlers/reporting');

router.get('/', middleware.authentication);
router.get('/', reportHandlers.getReports);

router.get('/instructor', middleware.authentication);
router.get('/instructor', reportHandlers.getInstructorReports);

module.exports = router;
