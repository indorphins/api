const StripeUser = require('../../db/StripeUser');
const Class = require('../../db/Class');
const Transaction = require('../../db/Transaction');
const log = require('../../log');
const utils = require('../../utils');
const { transaction } = require('.');

const APPLICATION_FEE_PERCENT = 20;

/**
 * Takes in a destination account and class id
 * Creates a stipe payment. Upon success sends data to
 * create a Transaction document in the db.
 * @param {Object} req
 * @param {Object} res
 * @param {Object} next
 */
async function create(req, res) {
  const classId = req.params.id;
  const paymentMethod = req.params.payment_id;
  const userId = req.ctx.userData.id;
  let instructor, user, classObj, price;

  if (!classId || !paymentMethod) {
    return res.status(400).json({
      message: 'Missing input parameters',
    });
  }

  try {
    classObj = await Class.findOne({
      id: classId,
    });
  } catch (err) {
    log.warn('createPayment find class - error: ', err);
    return res.status(404).json({
      message: err,
    });
  }

  if (!classObj) {
    return res.status(404).json({
      message: "Class not found"
    });
  }

  try {
    instructorAccount = await StripeUser.findOne({
      id: classObj.instructor
    });
  } catch (err) {
    return res.status(500).json({
      message: "Service error - instructor not found"
    });
  }

  try {
    user = await StripeUser.findOne({
      id: userId
    });
  } catch (err) {
    log.warn('createPayment find customer stripe user - error: ', err);
    return res.status(404).json({
      message: err,
    });
  }

  if (!user.customerId) {
    const msg = "No user stripe account";
    log.warn(msg);
    return res.status(400).json({
      message: msg,
    });
  }

  // Fetch the one-time payment cost - subscriptions handle recurring payment costs
  try {
    price = await utils.getProductPrices(classObj.product_sku, recurring);
  } catch (err) {
    log.warn('CreatePayment - error fetching one-time price ', err);
    return res.status(400).json({
      message: 'Payment intent failure - invalid price',
    });
  }

  if (!Array.isArray(price) || price.length < 1) {
    log.warn('CreatePaymentIntent - no prices for product found');
    return res.status(404).json({
      message: 'No price data found',
    });
  }

  let intent = {
    payment_method_types: ['card'],
    amount: price[0].unit_amount,
    currency: 'usd',
    customer: user.customerId,
    transfer_data: {
      destination: instructor.connectId, // where the money will go
    },
    on_behalf_of: instructor.connectId, // the account the money is intended for
    application_fee_amount: price[0].unit_amount * (APPLICATION_FEE_PERCENT / 100),
    payment_method: paymentMethod,
    metadata: {
      class_id: classId,
    },
  };

  stripe.paymentIntents.create(intent)
    .then((paymentIntent) => {
      return stripe.paymentIntents.confirm(paymentIntent.id);
    }).then(result => {

      let data = {
        paymentId: result.id,
        classId: classData.id,
        stripeId: user.customerId,
        userId: userId,
        status: result.status,
        type: 'debit',
        created_date: new Date().toISOString()
      };

      return Transaction.create(data);
    })
  then(transaction => {
    res.status(200).json({ client_secret: paymentIntent.client_secret });
  })
    .catch((error) => {
      log.warn('StripeController - createPayment - error : ', error);
      res.status(400).send(error);
    });
}

/**
 * Takes in a class id. Finds transaction using userId and classId
 * If transaction found and refund successful removes the user from class participant list
 * Stores refund data to req.ctx to update the transaction's status
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
async function refund(req, res) {
  const classId = req.params.id;
  const userId = req.ctx.userData.id;
  let refundTransaction;
  let stripeUser;

  let query = { classId: classId, userId: userId, type: 'debit' };
  let transaction;

  try {
    transaction = await Transaction.findOne(query);
  } catch (err) {
    log.warn('Stripe - refundCharge find transaction error: ', err);
    return res.status(500).json({
      message: err,
    });
  }

  if (!transaction) {
    return res.status(404).json({
      message: 'No transaction found',
    });
  }

  try {
    stripeUser = await StripeUser.findOne({
      id: userId
    });
  } catch (err) {
    log.warn('Stripe - refundCharge find transaction error: ', err);
    return res.status(500).json({
      message: err,
    });
  }

  if (!stripeUser) {
    return res.status(404).json({
      message: 'Stripe user not found',
    });
  }

  try {
    refundTransaction = await stripe.refunds.create({
      payment_intent: transaction.paymentId,
      reverse_transfer: true,
      refund_application_fee: true, // Gives back the platform fee
    });
  } catch (err) {
    log.warn('Stripe - refundCharge create refund error: ', err);
    return res.status(400).json({
      message: err,
    });
  }

  try {
    await Transaction.create({
      paymentId: refundTransaction.id,
      classId: classId,
      stripeId: stripeUser.customerId,
      userId: userId,
      status: refundTransaction.status,
      type: 'credit',
      created_date: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({
      message: "Service error"
    });
  }

  return res.status(200).json({
    message: "great success!"
  });
}

module.exports = {
  create,
  refund
};