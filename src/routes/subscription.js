const express = require('express');
const router = express.Router();
const middleware = require('../middleware');
const subscriptionHandlers = require("../handlers/stripe/subscription");

// Get all stripe products
router.get('/products', middleware.authentication);
router.get('/products', subscriptionHandlers.getProductsPrices);

// Get user's most recent subscription
router.get('/', middleware.authentication);
router.get('/', subscriptionHandlers.getSubscription);

// Cancel user's subscription 
router.delete('/', middleware.authentication);
router.delete('/', subscriptionHandlers.cancelSubscription);

// Create subscription for user
router.post('/', middleware.authentication);
router.post('/', subscriptionHandlers.createSubscription);

module.exports = router;