const express = require('express');
const router = express.Router();
const stripe = require('../handlers/stripe');

router.get('/callback', stripe.callback);

module.exports = router;
