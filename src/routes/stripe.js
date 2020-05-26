const express = require('express');
const stripe = express.Router();

const stripeController = require('../handlers/stripe');

stripe.get('/verifyToken', stripeController.authenticate);

stripe.post('/createPayment', stripeController.createPayment);

stripe.post('/createCustomer', stripeController.createCustomer);

stripe.post('/createSubscription', stripeController.createSubscription);

stripe.post('/retryInvoice', stripeController.retryInvoice);

stripe.post('/cancelSubscription', stripeController.cancelSubscription);

stripe.post('/webhook', stripeController.stripeWebhook);

stripe.post('/updateSubscription', stripeController.updateSubscription);

stripe.post('/getUpcomingInvoice', stripeController.retrieveUpcomingInvoice);

stripe.post(
	'/getPaymentMethod',
	stripeController.retrieveCustomerPaymentMethod
);

module.exports = stripe;
