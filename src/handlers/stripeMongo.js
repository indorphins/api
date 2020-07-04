const uuid = require('uuid');
const StripeUser = require('../db/StripeUser');
const Transaction = require('../db/Transaction');
const PaymentMethod = require('../db/PaymentMethod');
const log = require('../log');
const PAYMENT_CREATED = 'pending';

/**
 * Fetches a Stripe User based on their stripe ID
 * If no stripe ID provided, tries to fetch with user ID
 * TODO maybe just fetch by user id
 * @param {Object} req
 * @param {Object} res
 */
async function getStripeUser(req, res) {
  let id = req.ctx.userData.id;

  if (!id) {
    log.warn("getStripeUser - error no user id");
    return res.status(404).json({
      message: "User ID not found"
    })
  }

  let query = { id: id };
  let user;

  try {
    user = await StripeUser.findOne(query);
  } catch (err) {
    log.warn('getStripeUser - error: ', err);
    return res.status(404).json({
      message: err,
    });
  }

  if (!user) {
    return res.status(404).json({
      message: 'Stripe User not found',
    });
  }

  res.status(200).json({
    data: user,
  });
}

async function createTransaction(req, res) {
  const stripeData = req.ctx.stripeData;
  const userData = req.ctx.userData;
  const classData = req.ctx.classData;

  if (
    !userData.id ||
    (!stripeData.paymentId && !stripeData.subscription) ||
    !classData.id
  ) {
    return res.status(400).json({
      message: 'Stripe, class, and user data required',
    });
  }
  let transaction;
  let data = {
    classId: classData.id,
    stripeId: stripeData.stripeId,
    userId: userData.id,
    status: PAYMENT_CREATED,
    type: stripeData.type,
  };

  if (stripeData.paymentId) {
    data.paymentId = stripeData.paymentId;
  } else if (stripeData.subscription) {
    data.subscriptionId = stripeData.subscription.id;
  }

  try {
    transaction = await Transaction.create(data);
  } catch (err) {
    log.warn('createTransaction - error: ', err);
    return res.status(400).json({
      message: err,
    });
  }

  let user;

  try {
    user = await StripeUser.findOneAndUpdate(
      { id: userData.id },
      { $push: { transactions: stripeData.paymentId } }
    );
  } catch (err) {
    log.warn(
      'update stripe user payment methods with new payment method - error: ',
      err
    );
    return res.status(400).json({
      message: err,
    });
  }

  if (!user) {
    log.warn('createTransaction - no user found');
    return res.status(404).json({
      message: 'No User found',
    });
  }

  res.status(201).json({
    message: 'New transaction created',
    data: { client_secret: req.ctx.stripeData.client_secret },
  });
}

/**
 * Fetches a payment method based on payment method id
 * @param {Object} req
 * @param {Object} res
 */
async function getPaymentMethod(req, res) {
  let id = req.params.id;

  if (!id) {
    return res.status(400).json({
      message: 'Payment Method ID required',
    });
  }

  let query = { id: id };
  let paymentMethod;

  try {
    paymentMethod = await PaymentMethod.findOne(query);
  } catch (err) {
    log.warn('getPaymentMethod - error: ', err);
    return res.status(404).json({
      message: err,
    });
  }

  if (!paymentMethod) {
    return res.status(404).json({
      message: 'Payment Method not found',
    });
  }

  res.status(200).json({
    data: paymentMethod,
  });
}

/**
 * Updates a payment method found with payment method id
 * @param {Object} req
 * @param {Object} res
 */
async function updatePaymentMethod(req, res) {
  let id = req.params.id;

  if (!id) {
    return res.status(400).json({
      message: 'Payment Method ID required',
    });
  }

  let query = { id: id };
  let paymentMethod = null;

  try {
    paymentMethod = await StripeUser.findOne(query);
  } catch (err) {
    log.warn('updatePaymentMethod - error: ', err);
    return res.status(500).json({
      message: 'Service error',
      error: err,
    });
  }

  if (!paymentMethod) {
    log.debug('Payment Method not found');
    res.status(403).json({
      message: 'Forbidden',
    });
  }

  let data = req.body;

  try {
    await PaymentMethod.findOneAndUpdate(query, data, {
      upsert: true,
      new: false,
    });
  } catch (err) {
    log.warn('error updating payment method record', paymentMethod);
    return res.status(400).json({
      message: 'Issue updating data',
      error: err,
    });
  }

  res.status(200).json({
    message: 'Payment Method data updated',
  });
}


module.exports = {
  getStripeUser,
  createTransaction,
  getPaymentMethod,
};
