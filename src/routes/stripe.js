const express = require('express');
const router = express.Router();
const middleware = require('../middleware');
const stripeMongo = require('../handlers/stripeMongo');
const stripe = require('../handlers/stripe');
const c = require('../handlers/class');

router.get('/payment/method/', middleware.authentication);
router.get('/payment/method/', stripe.getUserPaymentMethods);

router.post('/payment/method/:id', middleware.authentication);
router.post('/payment/method/:id', stripe.attachPaymentMethod);

router.delete('/payment/method/:id', middleware.authentication);
router.delete('/payment/method/:id', stripe.removePaymentMethod);

router.post('/account', middleware.authentication);
router.post('/account', stripe.accountLink);

router.get('/account', middleware.authentication);
router.get('/account', stripeMongo.getStripeUser);

router.get('/callback', stripe.callback);

router.post('/subscription', middleware.authentication);
router.post('/subscription', stripe.createSubscription);
router.post('/subscription', stripeMongo.createTransaction);

router.delete('/subscription', middleware.authentication);
router.delete('/subscription', stripe.cancelSubscription);

// unused routes

router.post('/retryInvoice', stripe.retryInvoice);

router.post('/updateSubscription', stripe.updateSubscription);

module.exports = router;
