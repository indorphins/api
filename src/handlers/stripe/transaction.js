const StripeUser = require('../../db/StripeUser');
const Class = require('../../db/Class');
const Transaction = require('../../db/Transaction');
const Subscription = require('../../db/Subscription');
const User = require('../../db/User');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const log = require('../../log');
const utils = require('../../utils');

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
  const paymentMethod = req.params.payment_method_id;
  const userId = req.ctx.userData.id;
  let user, classObj, price;

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

  let exists = false;
  classObj.participants.forEach(function (p) {
    if (p.id == userId) {
      exists = true;
    }
  });

  if (exists) {
    return res.status(400).json({ message: "User already added to class" });
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

  price = Number(classObj.cost) * 100;
  let intent = {
    payment_method_types: ['card'],
    amount: price,
    currency: 'usd',
    customer: user.customerId,
    confirm: true,
    transfer_data: {
      destination: instructorAccount.accountId,
    },
    application_fee_amount: price * (APPLICATION_FEE_PERCENT / 100),
    payment_method: paymentMethod,
    metadata: {
      class_id: classId,
    },
  };

  let paymentIntent;
  try {
   paymentIntent = await stripe.paymentIntents.create(intent)
  } catch (err) {
    log.error('payment intent error', err);
    return res.status(400).json({
      message: err.message
    });
  }

  let data = {
    paymentId: paymentIntent.id,
    classId: classObj.id,
    stripeId: user.customerId,
    userId: userId,
    status: paymentIntent.status,
    type: 'debit',
    created_date: new Date().toISOString()
  };

  try {
    await Transaction.create(data);
  } catch (err) {
    log.warn("TRANSACTION:: add to db", err);
    return res.status(500).json({
      message: "Error creating transaction",
      error: err.message,
    });
  }
  
  if (classObj.recurring) {
    const now = new Date();
    const nextWindow = utils.getNextSession(now, classObj);
    let subscription;

    let nextDate = utils.getNextDate(classObj.recurring, 1, nextWindow.end);
    nextDate.setDate(nextDate.getDate() - 1);
    const timestamp = Math.round(nextDate.getTime() / 1000);

    log.debug("next subscription billing date", nextDate.toISOString(), timestamp);

    try {
      subscription = await stripe.subscriptions.create({
        customer: user.customerId,
        items: [{ price: classObj.product_price_id }],
        application_fee_percent: APPLICATION_FEE_PERCENT,
        transfer_data: {
          destination: instructorAccount.accountId,
        },
        off_session: true,
        //billing_cycle_anchor: timestamp,
        metadata: {
          class_id: classObj.id,
          prod_id: classObj.product_sku
        },
      });
    } catch(err) {
      log.error("subscription creation failed but initial class payment succeeded", err);
    }

    if (subscription) {
      let data = {
        id: subscription.id,
        class_id: classObj.id,
        stripe_id: user.customerId,
        user_id: userId,
      };
  
      try {
        await Subscription.create(data);
      } catch (err) {
        log.error('create subscription record fialed', err);
      }
    }
  }

  let participant = {
    id: userId,
    username: req.ctx.userData.username,
  };

  classObj.participants.push(participant);
  classObj.available_spots = classObj.available_spots - 1;

  let updatedClass;
  try {
   updatedClass = await Class.findOneAndUpdate({ id: classObj.id }, classObj, {new: true});
  } catch (err) {
    log.warn("error updating class", err);
    return res.status(500).json({
      message: "Error adding participant",
      error: err.message,
    });
  }

  let instructorData;
  try {
    instructorData = await User.findOne({id: classObj.instructor});
  } catch(err) {
    log.warn("fetch instructor user record", err);
    return res.status(500).json({
      message: "Error fetching instructor",
      error: err.message,
    });
  }

  updatedClass.instructor = JSON.stringify(instructorData);
  
  res.status(200).json(updatedClass);
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