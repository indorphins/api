const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const StripeUser = require('../../db/StripeUser');
const log = require('../../log');

const account = require('./account');
const transaction = require('./transaction');
const subscription = require('./subscription');
const webhook = require('./webhook');

async function getPaymentMethods(req, res) {
  let userData = req.ctx.userData
  let user;

  try {
    user = await StripeUser.findOne({ id: userData.id });
  } catch (err) {
    log.warn('getUserPaymentMethods - error: ', err);
    return res.status(404).json({
      message: err,
    });
  }

  if (!user) {
    let customer = await stripe.customers.create({
      email: userData.email,
    });

    let data = {
      id: userData.id,
      methods: [],
      customerId: customer.id,
    };
  
    try {
      user = await StripeUser.create(data);
    } catch (err) {
      log.warn('createStripeUser - error: ', err);
      return res.status(400).json({
        message: err,
      });
    }
  }

  res.status(200).json(user);
}

/**
 * Takes in a payment method ID and customer id and attaches it to the customer
 * Fetches the payment method details and stores relevant data in req.ctx.stripeData
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
async function addPaymentMethod(req, res) {

  const id = req.ctx.userData.id
  const email = req.ctx.userData.email;
  let paymentData = req.body;
  const query = {
    id: id
  }
  let user = null;

  if (!paymentData) {
    return res.status(400).json({
      message: "missing card data"
    });
  }

  try {
    user = await StripeUser.findOne(query);
  } catch (error) {
    log.warn('Error creating customer ', error);
    return res.status(400).json({
      message: error
    });
  }

  if (!user) {
    let customer = await stripe.customers.create({
      email: email,
    });

    let data = {
      id: userData.id,
      methods: [],
      customerId: customer.id,
    };
  
    try {
      user = await StripeUser.create(data);
    } catch (err) {
      log.warn('createStripeUser - error: ', err);
      return res.status(400).json({
        message: err,
      });
    }
  }

  try {
    await stripe.paymentMethods.attach(paymentData.id, {customer: user.customerId});
  } catch (err) {
    log.warn('Error attaching payment method ', err);
  }

  if (user.methods.length > 0) {
    user.methods.map(item => {
      return item.default = false;
    });
  }

  let record = {
    id: paymentData.id,
    default: true,
  };

  if (paymentData.card) {
    Object.assign(record, {
      last4: paymentData.card.last4,
      brand: paymentData.card.brand,
      type: 'card',
      exp_month: paymentData.card.exp_month,
      exp_year: paymentData.card.exp_year,
    });
  }

  user.methods.unshift(record);

  try {
    await StripeUser.findOneAndUpdate({ id: id }, user);
  } catch (err) {
    log.warn('update stripe user payment methods with new payment method - error: ', err);
    return res.status(400).json({
      message: err,
    });
  }

  return res.status(200).json(user);
}

/**
 * Takes in a payment method id and customer id and removes it from the customer
 * Stores the payment method id in req.ctx.stripeData
 * @param {Object} req
 * @param {Object} res
 * @param {*} next
 */
async function removePaymentMethod(req, res) {
  const userId = req.ctx.userData.id;
  const pMethodId = req.params.id;
  let stripeRecord = null;
  const query = {
    id: userId,
  };
  let user = null;

  try {
    user = await StripeUser.findOne(query);
  } catch (err) {
    log.warn(err);
    return res.status(404).json({
      message: err,
    });
  }

  if (!user) {
    return res.status(404).json({
      message: "no stripe user",
    });
  }

  try {
    stripeRecord = await stripe.paymentMethods.detach(pMethodId);
  } catch(err) {
    return res.status(400).json({
      message: err,
    });
  }

  if (!stripeRecord) {
    return res.status(404).json({
      message: "no stripe user record",
    });
  }

  try {
    await stripe.customers.deleteSource(user.customerId, pMethodId);
  } catch(err) {
    return res.status(400).json({
      message: err,
    });
  }

  let index = -1
  for (var i = 0; i < user.methods.length; i++) {
    if (user.methods[i].id === pMethodId) {
      index = i;
      break;
    }
  }

  user.methods.splice(index, 1);

  try {
    user = await StripeUser.findOneAndUpdate({ id: userId }, user);
  } catch (err) {
    log.warn(err);
    return res.status(404).json({
      message: err,
    });
  }

  res.status(200).json(user);
}

module.exports = {
  account,
  transaction,
  subscription,
  webhook,
  getPaymentMethods,
  addPaymentMethod,
  removePaymentMethod
}
