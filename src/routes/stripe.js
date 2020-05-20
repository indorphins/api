const express = require('express');
const stripe = express.Router();

const stripeController = require('../controllers/stripeController');

stripe.get('/verifyToken', stripeController.authenticate);

module.exports = stripe;
