const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const redis = require('redis');
const redisClient = redis.createClient(process.env.REDIS_CONNECTION);
const StripeUser = require('../db/StripeUser');
const User = require('../db/User');
const Class = require('../db/Class');
const Transaction = require('../db/Transaction');
const PaymentMethod = require('../db/PaymentMethod');
const base64 = require('uuid-base64');
const later = require('later');
const { v4: uuidv4 } = require('uuid');
const log = require('../log');
const user = require('./user');
const PAYMENT_PAID = 'fulfilled';
const PAYMENT_FAILED = 'failed';
const PAYMENT_CANCELLED = 'cancelled';
const PAYMENT_REFUNDED = 'refunded';
const ONE_TIME_CLASS_PRICE = 'price_1Gt1klG2VM6YY0SVf1lvBEBq'; // TODO make env vars once moving to prod
const RECURRING_CLASS_PRICE = 'price_1Gt1kmG2VM6YY0SVdXNBeMSJ';
const APPLICATION_FEE_PERCENT = 20;

redisClient.on('error', function (error) {
  log.warn("Redis Client Error: ", error);
});

const TTL = 1200; // 20 mins

function getNextDate(rule, count, refDate) {
  later.date.UTC();
  let sched = later.parse.cron(rule);
  return later.schedule(sched).next(count, refDate);
}

/**
 * Converts a UTC date to a timestamp
 * @param {Date} utcDate
 */
function toTimestamp(utcDate) {
  return utcDate.getTime() / 1000;
}

/** Takes in a stripe price object's unit decimal value and a decimalPercent
 * returns the amount the decimal percent is of the price value
 * Stripe price object's unit_amount value of 1000 equals $10 US
 */
function getApplicationFeeAmount(price, decimalPercent) {
  return price * decimalPercent;
}

/**
 * Verifies state matches in redis, and stripe code is verified by stripe
 * Then creates a Stripe User with new connect ID. Redirects user back to profile page
 * With success or error message in query params
 * @param {Object} req
 * @param {Object} res
 */
async function authenticate(req, res) {
  const { code, state } = req.query;
  let userData, returnUrl, redisValue;

  redisClient.get(state, function (err, reply) {
    log.info('Got reply redis : ', reply);
    if (err || !reply) {
      res.query;
      return res.redirect(PROFILE_REDIRECT + '?error=no_user_found');
    }
    redisValue = JSON.parse(reply);
    userData = redisValue.user;
    returnUrl = redisValue.return_url;
  });

  stripe.oauth
    .token({
      grant_type: 'authorization_code',
      code,
    })
    .then(
      (response) => {
        var connected_account_id = response.stripe_user_id;

        createStripeUserConnectAcct(connected_account_id, userData)
          .then(() => {
            res.redirect(returnUrl);
          })
          .catch((err) => {
            res.redirect(returnUrl + '?error=create_account_failed');
          });
      },
      (err) => {
        if (err.type === 'StripeInvalidGrantError') {
          res.redirect(returnUrl + '?error=invalid_auth_code');
        } else {
          res.redirect(returnUrl + '?error=unknown_error');
        }
      }
    );
}

/**
 * Takes in a destination account and class id
 * Creates a stipe payment. Upon success sends data to
 * create a Transaction document in the db.
 * @param {Object} req
 * @param {Object} res
 * @param {Object} next
 */
async function createPayment(req, res, next) {
  const instructorId = req.body.instructor_id;
  const classId = req.body.class_id;
  const paymentMethod = req.body.payment_method;
  const recurring = req.body.recurring;
  const userId = req.ctx.userData.id;

  if (!instructorId || !classId || !paymentMethod || !userId) {
    return res.status(400).json({
      message: 'Missing input parameters',
    });
  }

  let query = {
    id: instructorId,
  };
  let instructor, user, classObj, price;

  try {
    instructor = await StripeUser.findOne(query);
  } catch (err) {
    log.warn('createPayment find instructor stripe user - error: ', err);
    return res.status(404).json({
      message: err,
    });
  }

  query.id = userId;

  try {
    user = await StripeUser.findOne(query);
  } catch (err) {
    log.warn('createPayment find customer stripe user - error: ', err);
    return res.status(404).json({
      message: err,
    });
  }

  query = {
    id: classId,
  };

  try {
    classObj = await Class.findOne(query);
  } catch (err) {
    log.warn('createPayment find class - error: ', err);
    return res.status(404).json({
      message: err,
    });
  }

  if (!user.customerId || !classObj || !instructor.connectId) {
    const msg = !instructor.connectId
      ? 'Invalid destination account'
      : !user.customerId
        ? 'Invalid customer account'
        : 'Invalid class id';
    log.warn(msg);
    return res.status(400).json({
      message: msg,
    });
  }

  req.ctx.classData = {
    id: classId,
  };

  // Fetch the one-time payment cost - subscriptions handle recurring payment costs
  try {
    price = await getProductPrices(classObj.product_sku, recurring);
  } catch (err) {
    log.warn('CreatePayment - error fetching one-time price ', err);
    return res.status(400).json({
      message: 'Payment intent failure - invalid price',
    });
  }

  if (!Array.isArray(price) || !price[0]) {
    log.warn('CreatePaymentIntent - no prices for product found');
    return res.status(404).json({
      message: 'No price data found',
    });
  }


  // TODO how do we define application fee (what we take) and where?
  stripe.paymentIntents
    .create({
      payment_method_types: ['card'],
      amount: price[0].unit_amount,
      currency: 'usd',
      customer: user.customerId,
      transfer_data: {
        destination: instructor.connectId, // where the money will go
      },
      on_behalf_of: instructor.connectId, // the account the money is intended for
      application_fee_amount: getApplicationFeeAmount(
        price[0].unit_amount,
        APPLICATION_FEE_PERCENT / 100
      ), // what we take - stripe deducts their fee from this
      payment_method: paymentMethod,
      metadata: {
        class_id: classId,
      },
    })
    .then((paymentIntent) => {
      req.ctx.stripeData = {
        client_secret: paymentIntent.client_secret,
        paymentId: paymentIntent.id,
        type: 'payment',
      };
      next();
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
async function refundCharge(req, res, next) {
  const classId = req.body.class_id;
  const userId = req.ctx.userData.id;

  let query = { classId: classId, userId: userId };
  let transaction, classObj;

  try {
    transaction = await Transaction.findOne(query);
  } catch (err) {
    log.warn('Stripe - refundCharge find transaction error: ', err);
    return res.status(400).json({
      message: err,
    });
  }

  if (!transaction) {
    return res.status(404).json({
      message: 'No transaction found',
    });
  }

  query = {
    id: classId,
  };

  try {
    classObj = Class.findOne(query);
  } catch (err) {
    log.warn('Stripe - refundCharge find class error: ', err);
    return res.status(404).json({
      message: err,
    });
  }

  if (!classObj) {
    return res.status(404).json({
      message: 'No class found',
    });
  }

  try {
    const refund = await stripe.refunds.create({
      charge: transaction.paymentId,
      reverse_transfer: true,
      refund_application_fee: true, // Gives back the platform fee
    });
    req.ctx.stripeData = {
      refund: refund,
      status: PAYMENT_REFUNDED,
      paymentId: transaction.paymentId,
    };
    next();
  } catch (err) {
    log.warn('Stripe - refundCharge create refund error: ', err);
    return res.status(400).json({
      message: err,
    });
  }
}

/**
 * Generate state code. Store in redis.
 * Also store in req.ctx to pass along to next call.
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
async function generateState(req, res, next) {
  const return_url = req.body.return_url
  const id = req.ctx.userData.id;
  let user, redisValue;

  if (!id || !return_url) {
    log.warn("GenerateState - invalid input parameters");
    return res.status(400).json({
      message: "Invalid input parameters"
    })
  }

  let query = { id: id };

  try {
    user = await User.findOne(query);
  } catch (err) {
    log.warn('getUser - error: ', err);
    return res.status(404).json({
      message: err,
    });
  }

  if (!user) {
    return res.status(404).json({
      message: 'No user for token',
    });
  }

  redisValue = {
    user: user,
    return_url: return_url
  }

  // store state code in redis as [code: user-info] with expire time TTL
  const stateCode = base64.encode(uuidv4());
  redisClient.set(stateCode, JSON.stringify(redisValue), function (error) {
    if (error) {
      log.warn('Error saving state in redis: ', error);
      return res.status(400).send(error);
    }
    redisClient.expire(stateCode, TTL);
    req.ctx.state = stateCode;
    next();
  });
}

/**
 * Creates the redirect url with a state code for
 * setup of stripe connect account and redirects to it.
 * @param {Object} req
 * @param {Object} res
 */
async function connectAccountRedirect(req, res) {
  const TEST_CLIENT_ID = process.env.CONNECT_ACCT_CLIENT_KEY;
  const state = req.ctx.state;
  if (!state) {
    log.warn('getConnectAccountRedirectUrl - state code not found');
    return res.status(400).json({
      message: 'No state code for redirect',
    });
  }
  const uri = `https://connect.stripe.com/express/oauth/authorize?client_id=${TEST_CLIENT_ID}&state=${state}&suggested_capabilities[]=card_payments&suggested_capabilities[]=transfers&stipe_user[]=`;
  // res.status(301).redirect(uri);
  res.status(200).json({
    redirectUrl: uri,
  });
}

// Save the connected account ID from the response to your database.
async function createStripeUserConnectAcct(id, userData) {
  const userId = userData.id
  let user;

  if (!id || !userId) {
    log.warn("createStripeUserConnectAcct - invalid input parameters")
    throw Error("No connect or user ID");
  }

  try {
    // Check if user exists already and update if so
    user = await StripeUser.findOneAndUpdate({ id: userId }, { connectId: id }, { new: true })
    if (user) {
      return user;
    } else {
      user = await StripeUser.create({ connectId: id, id: userData.id });
      return user;
    }
  } catch (err) {
    log.warn('Sripe - saveAccountId error: ', err);
    throw err;
  }
}

/**
 * Takes in a user's email and creates a customer through stripe apis
 * Passes the customer data through via req.ctx.stripeData
 * @param {Object} req
 * @param {Object} res
 * @param {Object} next
 */
async function createCustomer(req, res, next) {
  const id = req.ctx.userData.id
  const email = req.body.email;

  if (!id || !email) {
    log.warn('CreateCustomer stripe handler no id or email');
    return res.status(400).json({
      message: 'Invalid user email or id'
    })
  }

  try {
    const query = {
      id: id
    }
    const user = await StripeUser.findOne(query);
    if (user) {
      log.info("CreateCustomer stripe handler - customer exists");
      return res.status(200).json({
        data: user,
        message: 'Stripe customer already exists'
      })
    }
    const customer = await stripe.customers.create({
      email: email,
    });
    req.ctx.stripeData = customer;
    next();
  } catch (error) {
    log.warn('Error creating customer ', error);
    res.status(400).json(error);
  }
}

/**
 * Takes in a payment method ID and customer id and attaches it to the customer
 * Fetches the payment method details and stores relevant data in req.ctx.stripeData
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
async function attachPaymentMethod(req, res, next) {
  try {
    const pMethodId = req.body.payment_method_id;
    const userId = req.ctx.userData.id;

    if (!pMethodId || !userId) {
      const msg =
        'Payment method ID and user ID required to attach payment method';
      log.warn(`attachPaymentMethod - ${msg}`);
      return res.status(400).json({
        message: msg,
      });
    }

    const query = { id: userId };
    let user;

    try {
      user = await StripeUser.findOne(query);
    } catch (err) {
      log.warn(err);
      return res.status(404).json({
        message: err,
      });
    }

    const pMethod = await stripe.paymentMethods.attach(pMethodId, {
      customer: user.customerId,
    });
    req.ctx.stripeData = {
      payment_method_id: pMethod.id,
      card_type: pMethod.card.brand,
      last_four: pMethod.card.last4,
    };
    next();
  } catch (err) {
    log.warn('Error attaching payment method ', err);
    res.status(400).json(err);
  }
}

/**
 * Takes in a payment method id and customer id and removes it from the customer
 * Stores the payment method id in req.ctx.stripeData
 * @param {Object} req
 * @param {Object} res
 * @param {*} next
 */
async function removePaymentMethod(req, res, next) {
  try {
    const pMethodId = req.body.payment_method_id;
    const userId = req.ctx.userData.id;

    if (!pMethodId || !userId) {
      const msg =
        'Payment method ID and user ID required to remove payment method';
      log.warn(`removePaymentMethod - ${msg}`);
      return res.status(400).json({
        message: msg,
      });
    }

    let user;
    const query = {
      id: userId,
    };

    try {
      user = await StripeUser.findOne(query);
    } catch (err) {
      log.warn(err);
      return res.status(404).json({
        message: err,
      });
    }

    if (!user || !user.customerId) {
      log.warn("RemovePaymentMethod stripe handler - no Stripe user found");
      return res.status(404).json({
        message: 'No stripe user found'
      })
    }

    const pMethod = await stripe.paymentMethods.detach(pMethodId);
    req.ctx.stripeData = {
      payment_method_id: pMethod.id,
    };
    next();
  } catch (err) {
    log.warn('Error creating customer ', err);
    res.status(400).json({
      err
    });
  }
}

async function createSubscription(req, res) {
  const classId = req.body.class_id;
  const userId = req.ctx.userData.id;
  let c, user, price, instructor, defaultPaymentMethod;

  let query = {
    id: classId,
  };

  try {
    c = await Class.findOne(query);
  } catch (err) {
    log.warn('CreateSubscription - fetch class error: ', err);
    return res.status(400).json({
      message: err,
    });
  }

  if (!c || !c.product_sku || !c.instructor || !c.start_date) {
    log.warn('CreateSubscription - no class data or sku');
    return res.status(404).json({
      message: 'Invalid class data',
    });
  }

  // Get 24 hours before the next class date as a timestamp for invoices to be generated
  const now = new Date();
  const nextDate = getNextDate(c.recurring, 1, now);
  nextDate.setDate(newDate.getDate() - 1);
  const nextTimestamp = toTimestamp(nextDate);
  log.debug('Next Timestamp is ', nextTimestamp);

  try {
    instructor = await User.findById(c.instructor);
  } catch (err) {
    log.warn('CreateSubscription - error fetching instructor');
    return res.status(400).json({
      message: err,
    });
  }

  if (!instructor || !instructor.id) {
    log.warn('CreateSubscription - instructor not found');
    return res.status(404).json({
      message: 'Invalid instructor data',
    });
  }

  query.id = instructor.id;

  try {
    instructor = await StripeUser.findOne(query);
  } catch (err) {
    log.warn('CreateSubscription - error fetching instructor stripe data');
    return res.status(400).json({
      message: err,
    });
  }

  if (!instructor || !instructor.connectId) {
    log.warn('CreateSubscription - instructor stripe user not found');
    return res.status(404).json({
      message: 'Invalid instructor data',
    });
  }

  query.id = userId;

  try {
    user = await StripeUser.findOne(query);
  } catch (err) {
    log.warn('CreateSubscription - fetch user error: ', err);
    return res.status(400).json({
      message: err,
    });
  }

  if (!user) {
    log.warn('CreateSubscription - no stripe user found ');
    return res.status(404).json({
      message: 'No stripe user found',
    });
  }

  query = {
    userId: user.id,
    default: true,
  };

  try {
    defaultPaymentMethod = await PaymentMethod.findOne(query);
  } catch (err) {
    log.warn('CreateSubscription - error fetching payment method ', err);
    return res.status(400).json({
      message: err,
    });
  }

  try {
    price = await getProductPrices(c.product_sku, true);
  } catch (err) {
    log.warn('CreateSubscription - error fetching product price');
    return res.status(400).json({
      message: 'Invalid price data',
    });
  }

  if (!price || !price[0]) {
    log.warn('CreateSubscription - Product price data not found');
    return res.status(404).json({
      message: 'Product price data not found',
    });
  }

  try {
    // Change the default invoice settings on the customer to the payment method associated with them
    await stripe.customers.update(user.customerId, {
      invoice_settings: {
        default_payment_method: defaultPaymentMethod.id,
      },
    });

    // Create the subscription
    const subscription = await stripe.subscriptions.create({
      customer: user.customerId,
      items: [{ price: price[0] }],
      expand: ['latest_invoice.payment_intent'],
      application_fee_percent: APPLICATION_FEE_PERCENT, // Percentage we take
      transfer_data: {
        destination: instructor.connectId, // Instructor's Connect Account
      },
      billing_cycle_anchor: nextTimestamp,
      metadata: {
        class_id: classId,
      },
    });

    req.ctx.stripeData = {
      subscription: subscription,
      type: 'subscription',
    };

    next();
  } catch (error) {
    return res.status(402).send({ error: error });
  }
}

/**
 * Takes in a payment_method_id
 * @param {Object} req
 * @param {Object} res
 */
async function retryInvoice(req, res) {
  const userData = req.ctx.userData;
  let user;

  if (!userData.id) {
    return res.status(400).json({
      message: 'Invalid user data',
    });
  }

  let query = {
    id: userData.id,
  };

  try {
    user = await StripeUser.findOne(query);
  } catch (err) {
    log.warn('RetryInvoice - error fetching stripe user ', user);
    return res.status(400).json({
      message: 'Error fetching user data',
    });
  }

  // Set the default payment method on the customer
  try {
    await stripe.paymentMethods.attach(req.body.payment_method_id, {
      customer: user.customerId,
    });
    await stripe.customers.update(req.body.customerId, {
      invoice_settings: {
        default_payment_method: req.body.payment_method_id,
      },
    });
    const invoice = await stripe.invoices.retrieve(req.body.invoiceId, {
      expand: ['payment_intent'],
    });
    res.send(invoice);
  } catch (error) {
    // in case card_decline error
    return res
      .status('402')
      .send({ result: { error: { message: error.message } } });
  }
}

/**
 * Takes in a class ID and cancels the stripe subscription for a user in the class
 * Updates the transaction associated with the subscription as well
 * @param {Object} req
 * @param {Object} res
 */
async function cancelSubscription(req, res) {
  const userData = req.ctx.userData;
  const classId = req.body.class_id;
  let transaction;

  if (!userData.id || !classId) {
    log.warn('CancelSubscription - No user ID or class ID passed');
    return res.status(400).json({
      message: 'No IDs passed',
    });
  }

  let query = {
    userId: userData.id,
    classId: classId,
    type: 'subscription',
  };

  try {
    transaction = await Transaction.findOne(query);
  } catch (err) {
    log.warn('CancelSubscription - error finding transaction: ', err);
    return res.status(400).json({
      message: err,
    });
  }

  if (!transaction.subscriptionId) {
    log.warn('CancelSubscription - this transaction has no subscription ID');
    return res.status(400).json({
      message: 'No subscription to cancel',
    });
  }

  try {
    // Delete the subscription
    const deletedSubscription = await stripe.subscriptions.del(
      transaction.subscriptionId
    );
    res.status(200).json({
      message: 'Deleted Subscription',
      data: deletedSubscription,
    });
  } catch (err) {
    res.status(400).json({
      message: err,
    });
  }
}

/**
 * Webhook for stripe event handling
 * receives an event and the relevant payment object
 * @param {Object} req
 * @param {Object} res
 */
async function invoiceWebhook(req, res) {
  // Retrieve the event by verifying the signature using the raw body and secret.
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET // TODO add this
    );
    log.info('Stripe webhook event: ', event);
  } catch (err) {
    log.warn('Stripe Webhook error: ', err);
    return res.sendStatus(400);
  }
  const dataObject = event.data.object;

  if (event.type === 'invoice.payment_succeeded') {
    updateInvoiceStatus(dataObject, PAYMENT_PAID)
      .then((transaction) => {
        return addUserToClass(
          dataObject.metadata.class_id,
          dataObject.customer
        );
      })
      .catch((error) => {
        log.warn('Stripe Webhook error - invoice.payment_succeeded - ', error);
        return res.status(400).json({
          message: error,
        });
      });
  }
  if (
    event.type === 'invoice.payment_failed' ||
    event.type === 'invoice.voided' ||
    event.type === 'invoice.marked_uncollectible'
  ) {
    updateInvoiceStatus(dataObject, PAYMENT_FAILED)
      .then((transaction) => {
        return removeUserFromClass(
          dataObject.metadata.class_id,
          dataObject.customer
        ).then((result) => {
          // TODO notify user of failed invoice
          stripe.subscriptions
            .del(transaction.subscriptionId)
            .then((deletedSub) => {
              updateSubscriptionStatus(deletedSub, PAYMENT_CANCELLED).then(
                (transaction) => {
                  res.status(200).json({
                    message: 'Invoice Failed - Cancelled Subscription',
                    data: deletedSubscription,
                  });
                }
              );
            });
        });
      })
      .catch((error) => {
        log.warn('Stripe Webhook error - invoice.payment_failed - ', error);
        return res.status(400).json({
          message: error,
        });
      });
  } else {
    res.status(400).json({
      message: 'Unhandled stripe webhook event',
    });
  }
  res.sendStatus(200);
}

/**
 * Updates a transaction status with input status string
 * Creates a transaction if one doesn't already exist
 * Returns the updated transaction
 * @param {Object}
 * @param {String} status
 */
async function updateInvoiceStatus(invoice, status) {
  let query = {
    paymentId: invoice.id,
  };
  let transaction;
  try {
    transaction = await Transaction.findOneAndUpdate(query, {
      status: status,
    });
  } catch (err) {
    log.warn('updateInvoiceStatus - update transaction error: ', error);
    return res.status(404).json({
      message: err,
    });
  }

  // If no transaction found create one for the invoice as it is being processed by us for the first time
  if (!transaction) {
    let user;
    query = {
      customerId: invoice.customer,
    };
    try {
      user = await StripeUser.findOne(query);
    } catch (err) {
      log.warn('updateInvoiceStatus - failed to find stripe user');
      return res.status(404).json({
        message: 'No Stripe user found',
      });
    }
    let data = {
      classId: metadata.class_id,
      userId: user.id,
      stripeId: invoice.customer,
      paymentId: invoice.id,
      subscriptionId: invoice.subscription,
      status: status,
      type: 'invoice',
    };
    try {
      transaction = await Transaction.create(data);
    } catch (err) {
      log.warn('updateInvoiceStatus - error creating transaction ', err);
      return res.status(400).json({
        message: 'Error creating transaction',
      });
    }
  }

  return transaction;
}

/**
 * Updates a subscription transaction status with input status string
 * If there's no subscription transaction create one
 * Returns the updated subscription transaction
 * TODO could dry this up with updateInvoiceStatus
 * @param {Object}
 * @param {String} status
 */
async function updateSubscriptionStatus(subscription, status) {
  let query = {
    subscriptionId: subscription.id,
  };
  let transaction;
  try {
    transaction = await Transaction.findOneAndUpdate(query, {
      status: status,
    });
  } catch (err) {
    log.warn('updateSubscriptionStatus - update transaction error: ', error);
    return res.status(404).json({
      message: err,
    });
  }

  // If no transaction found create one for the invoice as it is being processed by us for the first time
  // (though subscriptions should be already created and if not its probably a mistake on our end)
  if (!transaction) {
    let user;
    query = {
      customerId: invoice.customer,
    };
    try {
      user = await StripeUser.findOne(query);
    } catch (err) {
      log.warn('updateSubscriptionStatus - failed to find stripe user');
      return res.status(404).json({
        message: 'No Stripe user found',
      });
    }
    let data = {
      classId: metadata.class_id,
      userId: user.id,
      stripeId: invoice.customer,
      paymentId: '',
      subscriptionId: invoice.subscription,
      status: status,
      type: 'subscription',
    };
    try {
      transaction = await Transaction.create(data);
    } catch (err) {
      log.warn('updateSubscriptionStatus - error creating transaction ', err);
      return res.status(400).json({
        message: 'Error creating transaction',
      });
    }
  }

  return transaction;
}

/**
 * Adds a user to a class' participants array
 * Called after successful payment of participant for class
 * Sends response with class object
 * @param {String} classId
 * @param {String} stripeId
 */
async function addUserToClass(classId, stripeId) {
  let query = {
    customerId: stripeId,
  };
  let user;

  try {
    user = StripeUser.findOne(query);
  } catch (err) {
    log.warn('addUserToClass find stripe user error: ', err);
    return res.status(404).json({
      message: err,
    });
  }

  if (!user) {
    log.warn('addUserToClass no stripe user found');
    return res.status(404).json({
      message: 'No user found',
    });
  }

  let c;
  // Add user to class if not already a participant
  try {
    c = await Class.findOneAndUpdate(
      { id: classId, participants: { $ne: user.id } },
      { $push: { participants: user.id } }
    );
  } catch (err) {
    log.warn('addUserToClass add user to class error: ', err);
    return res.status(404).json({
      message: err,
    });
  }

  if (!c || !user) {
    log.warn('addUserToClass - User or Class not found');
    return res.send(404).json({
      message: 'User or Class not found',
    });
  }

  res.status(200).json({
    message: 'success',
    data: c,
  });
}

/**
 * Removes a user from a class' participants array
 * Called after failed payment of participant for class
 * Returns the Class
 * @param {String} classId
 * @param {String} stripeId
 * @returns {Object} class
 */
async function removeUserFromClass(classId, stripeId) {
  let query = {
    customerId: stripeId,
  };
  let user;

  try {
    user = StripeUser.findOne(query);
  } catch (err) {
    log.warn('removeUserFromClass find stripe user error: ', err);
    return res.status(400).json({
      message: err,
    });
  }

  if (!user) {
    log.warn('removeUserFromClass no stripe user found ');
    return res.status(404).json({
      message: 'No user found',
    });
  }

  let c;
  // Remove any users that match this user's ID
  try {
    c = await Class.findOneAndUpdate(
      { id: classId },
      { $pullAll: { participants: user.id } }
    );
  } catch (err) {
    log.warn('removeUserFromClass remove user from class error: ', err);
    return res.status(400).json({
      message: err,
    });
  }

  if (!c || !user) {
    log.warn('removeUserFromClass - User or Class not found');
    return res.send(404).json({
      message: 'User or Class not found',
    });
  }

  return c;
}

/**
 * Finds transaction with input class ID and user ID
 * Confirms the payment intent and sets the stripe data in req.ctx
 * to update the Transaction status
 * @param {Object} req
 * @param {Object} res
 * @param {*} next
 */
async function confirmPayment(req, res, next) {
  const paymentId = req.body.payment_id;

  let query = { paymentId: paymentId };
  let transaction;

  try {
    transaction = await Transaction.findOne(query);
  } catch (err) {
    log.warn('Stripe - confirmPayment find transaction error: ', err);
    return res.status(400).json({
      message: err,
    });
  }

  if (!transaction) {
    return res.status(404).json({
      message: 'No transaction found',
    });
  }
  // TODO eventually move payment confirmation to backend (currently happens on client side)
  req.ctx.stripeData = {
    paymentId: paymentId,
    status: PAYMENT_PAID,
  };
  next();
}

/**
 * Fetches the recurring/one-time prices associated with a product sku
 * Returns an array of price objects
 * @param {String} sku
 * @param {Boolean} recurring
 */
async function getProductPrices(sku, recurring) {
  try {
    const options = {
      product: sku,
      type: recurring ? 'recurring' : 'one_time',
    };
    const prices = await stripe.prices.list(options);
    log.info('Fetched stripe prices for sku ', sku);
    return prices.data;
  } catch (err) {
    log.warn('Stripe getProductPrices error : ', err);
    throw err;
  }
}

/**
 * Gets the stripe price object for a given price ID
 * Returns the JSON price object from stripe
 * @param {*} id
 */
async function getPrice(id) {
  try {
    const price = await stripe.prices.retrieve(id);
    log.info('Fetched stripe price for id: ', price);
    return price;
  } catch (err) {
    log.warn('Stripe get price error ', err);
    throw err;
  }
}

/**
 * Creates a price with cost "unitCost" and ties it to the product at "productSku"
 * Returns the JSON price object from stripe
 * @param {String} unitCost 1000 represents $10
 * @param {String} productSku
 * @param {Boolean} billingInterval
 */
async function createPrice(unitCost, productSku, recurring) {
  const options = {
    unit_amount_decimal: unitCost,
    currency: 'usd',
    product: productSku,
    billing_scheme: 'per_unit',
    nickname: `one-time payment for ${productSku}`,
  };

  // If recurring price - set up weekly billing
  if (recurring) {
    options.recurring = {
      interval: 'week',
    };
    options.nickname = `recurring payment for ${productSku}`;
  }

  try {
    const price = await stripe.prices.create(options);
    log.info('Created stripe price object ', price);
    return price;
  } catch (err) {
    log.warn('error creating stripe price object ', err);
    throw err;
  }
}

/**
 * Creates a product sku for a fitness class id. Pulls the price data from
 * the stripe price IDs set up as "Master Prices". Adds our Mongo Class ID to
 * the product's metadata. Can eventually add "name" and "statement_descriptor" fields
 * to better distinguish products once we have a good idea of the integration with classes.
 * Next function call should store the product sku with the Mongo Class.
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
async function createClassSku(req, res, next) {
  const classId = req.body.class_id;
  const options = {
    name: classId,
    metadata: {
      class_id: classId,
    },
  };

  stripe.products.create(options, function (err, product) {
    if (err) {
      return res.status(400).json({
        message: err,
      });
    }
    log.debug('Created new product sku ', product);

    // Fetch master prices for one-time and recurring payments & create duplicates to attach to new sku
    return getPrice(ONE_TIME_CLASS_PRICE)
      .then((priceObj) => {
        return createPrice(priceObj.unit_amount_decimal, product.id, false);
      })
      .then((priceObj) => {
        return getPrice(RECURRING_CLASS_PRICE);
      })
      .then((priceObj) => {
        return createPrice(priceObj.unit_amount_decimal, product.id, true);
      })
      .then(async (priceObj) => {
        log.info(
          'Successfully created new stripe product sku for class ',
          classId
        );
        req.body = {
          product_sku: product.id
        }
        req.ctx.classId = classId;
        next();
      })
      .catch((err) => {
        log.warn('CreateClassSku error : ', err);
        res.status(400).json({
          message: err,
        });
      });
  });
}

//------Unused Methods------//

// Returns the invoice for a subscription id after a user has updated their subscription to a new one
async function retrieveUpcomingInvoice(req, res) {
  const priceId = req.body.priceId; // the new subscription
  const subscription = await stripe.subscriptions.retrieve(
    req.body.subscriptionId
  );
  const invoice = await stripe.invoices.retrieveUpcoming({
    subscription_prorate: true,
    customer: req.body.customerId,
    subscription: req.body.subscriptionId,
    subscription_items: [
      {
        id: subscription.items.data[0].id,
        deleted: true,
      },
      {
        // This price ID is the price you want to change the subscription to.
        price: priceId,
        deleted: false,
      },
    ],
  });
  res.send(invoice);
}

// Returns payment method details for input paymentMethodId
async function retrieveCustomerPaymentMethod(req, res) {
  const paymentMethod = await stripe.paymentMethods.retrieve(
    req.body.paymentMethodId
  );
  res.send(paymentMethod);
}

// Updates a user's subscription
async function updateSubscription(req, res) {
  const priceId = req.body.priceId; // the new subscription
  const subscription = await stripe.subscriptions.retrieve(
    req.body.subscriptionId
  );
  const updatedSubscription = await stripe.subscriptions.update(
    req.body.subscriptionId,
    {
      cancel_at_period_end: false,
      items: [
        {
          id: subscription.items.data[0].id,
          price: priceId,
        },
      ],
    }
  );
  res.send(updatedSubscription);
}

module.exports = {
  authenticate,
  createPayment,
  refundCharge,
  createCustomer,
  createSubscription,
  retryInvoice,
  invoiceWebhook,
  updateSubscription,
  retrieveUpcomingInvoice,
  retrieveCustomerPaymentMethod,
  cancelSubscription,
  generateState,
  attachPaymentMethod,
  removePaymentMethod,
  confirmPayment,
  connectAccountRedirect,
  createClassSku,
};
