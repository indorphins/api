const express = require('express');
const router = express.Router();
//const middleware = require('../middleware');
const campaign = require('../handlers/campaign');

//router.get('/id/:id', middleware.authentication);
router.get('/id/:id', campaign.get);

module.exports = router;
