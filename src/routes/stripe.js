const express = require('express');
const stripe = express.Router();

const stripeController = require('../controllers/stripeController');

stripe.get('/verifyToken', stripeController.authenticate);

stripe.post('/createPayment', stripeController.createPayment);

stripe.post('/createCustomer', stripeController.createCustomer);

module.exports = stripe;
