const express = require('express');
const router = express.Router();
const stripe = require('../handlers/stripe');

router.get('/verify', stripe.account.callback);

module.exports = router;
