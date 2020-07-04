const express = require('express');
const middleware = require('../middleware');
const user = require('../handlers/user');
const stripe = require('../handlers/stripe');

let router = express.Router();
router.post('/', middleware.authentication);
router.post('/', user.createUser);

router.get('/', middleware.authentication);
router.get('/', user.getUser);

router.delete('/', middleware.authentication);
router.delete('/', user.deleteUser);

router.put('/', middleware.authentication);
router.put('/', user.updateUser);

router.get('/paymentmethod/', middleware.authentication);
router.get('/paymentmethod/', stripe.getPaymentMethods);

router.post('/paymentmethod/:id', middleware.authentication);
router.post('/paymentmethod/:id', stripe.addPaymentMethod);

router.delete('/paymentmethod/:id', middleware.authentication);
router.delete('/paymentmethod/:id', stripe.removePaymentMethod);

router.post('/account', middleware.authentication);
router.post('/account', stripe.account.linkBankAccount);

module.exports = router;
