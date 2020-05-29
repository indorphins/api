const express = require('express');
const router = express.Router();
const middleware = require('../middleware');
const stripeMongo = require('../handlers/stripeMongo');
const stripe = require('../handlers/stripe');

router.post('/payment', middleware.authentication);
router.post('/payment', stripe.createPayment);
router.post('/payment', stripeMongo.createTransaction);

router.post('/customer', middleware.authentication);
router.post('/customer', stripe.createCustomer);
router.post('/customer', stripeMongo.createStripeUser);

router.post('/paymentMethod', middleware.authentication);
router.post('/paymentMethod', stripe.createCustomer);
router.post('/paymentMethod', stripeMongo.createPaymentMethod);

router.post('/createSubscription', stripe.createSubscription);

router.post('/retryInvoice', stripe.retryInvoice);

router.post('/cancelSubscription', stripe.cancelSubscription);

router.post('/webhook', stripe.stripeWebhook);

router.post('/updateSubscription', stripe.updateSubscription);

router.post('/getUpcomingInvoice', stripe.retrieveUpcomingInvoice);

router.post('/getPaymentMethod', stripe.retrieveCustomerPaymentMethod);

router.get('/state', middleware.authentication);
router.get('/state', stripe.generateState);

router.get('/verify', stripe.authenticate);

module.exports = router;
