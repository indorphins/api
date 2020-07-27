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

router.post('/paymentmethod/', middleware.authentication);
router.post('/paymentmethod/', stripe.addPaymentMethod);

router.patch('/paymentmethod/', middleware.authentication);
router.patch('/paymentmethod/', stripe.updatePaymentMethod);

router.delete('/paymentmethod/:id', middleware.authentication);
router.delete('/paymentmethod/:id', stripe.removePaymentMethod);

router.get('/account', stripe.account.linkBankAccount);

module.exports = router;
