const express = require('express');
const router = express.Router();
const middleware = require('../middleware');
const stripeMongo = require('../handlers/stripeMongo');
const stripe = require('../handlers/stripe');
const c = require('../handlers/class');
const bodyParser = require('body-parser');

router.post('/payment', middleware.authentication);
router.post('/payment', stripe.createPayment);
router.post('/payment', stripeMongo.createTransaction);

router.post('/refund', middleware.authentication);
router.post('/refund', stripe.refundCharge);
router.post('/refund', stripeMongo.updateTransaction);

router.post('/confirmPayment', middleware.authentication);
router.post('/confirmPayment', stripe.confirmPayment);
router.post('/confirmPayment', stripeMongo.updateTransaction);

router.post('/customer', middleware.authentication);
router.post('/customer', stripe.createCustomer);
router.post('/customer', stripeMongo.createStripeUser);

router.get('/customer', middleware.authentication);
router.get('/customer', stripeMongo.getStripeUser);

router.post('/paymentMethod', middleware.authentication);
router.post('/paymentMethod', stripe.attachPaymentMethod);
router.post('/paymentMethod', stripeMongo.createPaymentMethod);

router.get('/paymentMethods', middleware.authentication);
router.get('/paymentMethods', stripeMongo.getUserPaymentMethods);

router.delete('/paymentMethod', middleware.authentication);
router.delete('/paymentMethod', stripe.removePaymentMethod);
router.delete('/paymentMethod', stripeMongo.deletePaymentMethod);

router.post('/accountRedirect', middleware.authentication);
router.post('/accountRedirect', stripe.generateState);
router.post('/accountRedirect', stripe.connectAccountRedirect);

router.get('/verify', stripe.authenticate);

router.post('/classSku', middleware.authentication);
router.post('/classSku', stripe.createClassSku);
router.post('/classSku', c.updateClass);

router.post('/subscription', middleware.authentication);
router.post('/subscription', stripe.createSubscription);
router.post('/subscription', stripeMongo.createTransaction);

router.delete('/subscription', middleware.authentication);
router.delete('/subscription', stripe.cancelSubscription);

// unused routes

router.post('/retryInvoice', stripe.retryInvoice);

router.post('/updateSubscription', stripe.updateSubscription);

module.exports = router;
