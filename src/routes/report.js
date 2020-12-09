const express = require('express');
const router = express.Router();
const middleware = require('../middleware');
const reportHandlers = require('../handlers/reporting');
const payoutHandlers = require('../handlers/stripe/payouts');

router.get('/', middleware.authentication);
router.get('/', reportHandlers.getReports);

router.get('/instructor', middleware.authentication);
router.get('/instructor', reportHandlers.getInstructorReports);

router.get('/payouts/:start_date/:end_date', middleware.authentication);
router.get('/payouts/:start_date/:end_date', payoutHandlers.getInstructorsSubShare);

module.exports = router;
