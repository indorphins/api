const StripeUser = require('../../db/StripeUser');
const log = require('../../log');

const account = require('./account');
const transaction = require('./transaction');
const subscription = require('./subscription');
const webhook = require('./webhook');

async function getPaymentMethods(req, res) {
  let id = req.ctx.userData.id;
  let user;

  try {
    user = await StripeUser.findOne({ id: id });
  } catch (err) {
    log.warn('getUserPaymentMethods - error: ', err);
    return res.status(404).json({
      message: err,
    });
  }

  if (!user) {
    let customer = await stripe.customers.create({
      email: email,
    });

    let data = {
      id: userData.id,
      paymentMethods: [],
      transactions: [],
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
  const pMethodId = req.params.id;
  const query = {
    id: id
  }
  let user = null;

  if (!pMethodId) {
    const msg = 'Payment method ID and user ID required to attach payment method';
    log.warn(`attachPaymentMethod - ${msg}`);
    return res.status(400).json({
      message: msg,
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
      paymentMethods: [],
      transactions: [],
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

  let paymentData;
  try {
    paymentData = await stripe.paymentMethods.attach(pMethodId, {
      customer: user.customerId,
    });
  } catch (err) {
    log.warn('Error attaching payment method ', err);
    res.status(500).json({
      message: err
    });
  }

  user.methods.push({
    id: paymentData.id,
    last4: paymentData.card.last4,
    type: paymentData.card.brand,
    default: true,
  });

  try {
    await StripeUser.findOneAndUpdate({ id: userData.id }, user);
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

  res.status(200).json({
    message: "great success!",
  });
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
