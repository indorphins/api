const express = require('express');
const router = express.Router();
const stripe = require('../handlers/stripe');

router.get('/verify', stripe.account.callback);

router.post('/webhook', stripe.webhook.invoiceWebhook)

router.post('/dev/webhook', stripe.webhook.devWebhook)

module.exports = router;
