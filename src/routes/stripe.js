const express = require('express');
const stripe = express.Router();

const stripeController = require('../controllers/stripeController');

stripe.get('/verifyToken', stripeController.authenticate);

stripe.post('/createPayment', stripeController.createPayment);

module.exports = stripe;
