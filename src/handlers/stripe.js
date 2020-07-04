const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const redisClient = require('../cache');
const StripeUser = require('../db/StripeUser');
const Class = require('../db/Class');
const Transaction = require('../db/Transaction');
const base64 = require('uuid-base64');
const { v4: uuidv4 } = require('uuid');
const log = require('../log');
const utils = require('../utils');

const APPLICATION_FEE_PERCENT = 20;
const TTL = 1200; // 20 mins

/**
 * Generate state code. Store in redis.
 * Also store in req.ctx to pass along to next call.
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
export async function accountLink(req, res) {
  const return_url = req.body.return_url
  const user = req.ctx.userData;
  const CLIENT_ID = process.env.CONNECT_ACCT_CLIENT_KEY;
  let redisValue;
  let stripeUser;

  redisValue = {
    user: user,
    return_url: return_url
  }

  try {
    // Check if user exists already and update if so
    stripeUser = await StripeUser.findOne({ id: user.id });
  } catch (err) {
    log.warn('Sripe - saveAccountId error: ', err);
    throw err;
  }

  if (!stripeUser) {
    let customer = await stripe.customers.create({
      email: user.email,
    });

    let data = {
      id: user.id,
      paymentMethods: [],
      transactions: [],
      customerId: customer.id,
    };
  
    try {
      stripeUser = await StripeUser.create(data);
    } catch (err) {
      log.warn('createStripeUser - error: ', err);
      return res.status(400).json({
        message: err,
      });
    }
  }

  // store state code in redis as [code: user-info] with expire time TTL
  const stateCode = base64.encode(uuidv4());

  try {
    await redisClient.set(stateCode, JSON.stringify(redisValue), TTL);
  } catch(err) {
    log.warn('Error saving state in redis: ', error);
    return res.status(400).send(error);
  }

  const uri = `https://connect.stripe.com/express/oauth/authorize?client_id=${CLIENT_ID}&state=${stateCode}&suggested_capabilities[]=card_payments&suggested_capabilities[]=transfers&stipe_user[]=`;
  res.status(200).json({
    redirectUrl: uri,
  });
}

/**
 * Verifies state matches in redis, and stripe code is verified by stripe
 * Then creates a Stripe User with new connect ID. Redirects user back to profile page
 * With success or error message in query params
 * @param {Object} req
 * @param {Object} res
 */
export async function callback(req, res) {
  const { code, state } = req.query;
  let redisValue, cacheData;

  try {
    redisValue = await redisClient.get(state);
    cacheData = JSON.parse(redisValue);
  } catch(err) {
    return res.status(400).json({
      message: "service error"
    });
  }

  let userData = cacheData.user;
  let returnUrl = cacheData.return_url;

  stripe.oauth.token({grant_type: 'authorization_code', code})
    .then(response => {
      const userId = userData.id
    
      if (!id || !userId) {
        log.warn("createStripeUserConnectAcct - invalid input parameters")
        throw Error("No connect or user ID");
      }
    
      try {
        // Check if user exists already and update if so
        await StripeUser.findOneAndUpdate({ id: userId }, { connectId: response.stripe_user_id }, { new: true })

      } catch (err) {
        log.error('Stripe - saveAccountId error: ', err);
        return res.redirect(returnUrl + '?error=service_error');
      }

      return res.redirect(returnUrl);
    }).catch(err => {
      if (err.type === 'StripeInvalidGrantError') {
        return res.redirect(returnUrl + '?error=invalid_auth_code');
      }
      
      res.redirect(returnUrl + '?error=unknown_error');
    });
}

/**
 * Takes in a destination account and class id
 * Creates a stipe payment. Upon success sends data to
 * create a Transaction document in the db.
 * @param {Object} req
 * @param {Object} res
 * @param {Object} next
 */
export async function createPayment(req, res) {
  const classId = req.params.id;
  const paymentMethod = req.params.payment_id;
  const userId = req.ctx.userData.id;
  let instructor, instructorAccount, user, classObj, price;

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
      };

      try {
        transaction = await Transaction.create(data);
      } catch (err) {
        log.warn('createTransaction - error: ', err);
        return res.status(400).json({
          message: err,
        });
      }

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
export async function refundCharge(req, res, next) {
  const classId = req.body.class_id;
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
  } catch(err) {
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
    });
  } catch(err) {
    return res.status(500).json({
      message: "Service error"
    });
  }

  return res.status(200).json({
    message: "great success!"
  });
}

/**
 * Takes in a payment method ID and customer id and attaches it to the customer
 * Fetches the payment method details and stores relevant data in req.ctx.stripeData
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
export async function attachPaymentMethod(req, res, next) {

  const id = req.ctx.userData.id
  const email = req.ctx.userData.email;
  const pMethodId = req.params.id;
  const query = {
    id: id
  }
  let user = null;

  if (!pMethodId) {
    const msg =
      'Payment method ID and user ID required to attach payment method';
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
    await StripeUser.findOneAndUpdate(
      { id: userData.id },
      user
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
}

/**
 * Takes in a payment method id and customer id and removes it from the customer
 * Stores the payment method id in req.ctx.stripeData
 * @param {Object} req
 * @param {Object} res
 * @param {*} next
 */
export async function removePaymentMethod(req, res, next) {
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

  try {
    stripeRecord = await stripe.paymentMethods.detach(pMethodId);
  } catch(err) {
    return res.status(400).json({
      message: err,
    });
  }

  if (!user || !stripeRecord) {
    return res.status(404).json({
      message: "no stripe user",
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

export async function getUserPaymentMethods(req, res) {
  let id = req.ctx.userData.id;
  let query = { id: id };
  let user;

  try {
    user = await StripeUser.findOne(query);
  } catch (err) {
    log.warn('getUserPaymentMethods - error: ', err);
    return res.status(404).json({
      message: err,
    });
  }

  if (!user) {
    log.warn("GetPaymentMethods - no stripe user found");
    return res.status(404).json({
      message: "No stripe user found"
    })
  }

  res.status(200).json(user);
}
