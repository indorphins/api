const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Subscription = require('../../db/Subscription');
const utils = require('../../utils');

/**
 * Takes in a class ID and cancels the stripe subscription for a user in the class
 * Updates the transaction associated with the subscription as well
 * @param {Object} req
 * @param {Object} res
 */
async function cancel(req, res) {
  const userData = req.ctx.userData;
  const classId = req.params.id;
  let sub;

  if (!classId) {
    log.warn('CancelSubscription - No class ID passed');
    return res.status(400).json({
      message: 'No class id',
    });
  }

  let query = {
    userId: userData.id,
    classId: classId,
  };

  try {
    sub = await Subscription.findOne(query);
  } catch (err) {
    log.warn('CancelSubscription - error finding subscription', err);
    return res.status(400).json({
      message: err,
    });
  }

  if (!sub.id) {
    return res.status(404).json({
      message: 'No subscription found',
    });
  }

  try {
    await stripe.subscriptions.del(sub.id);
  } catch (err) {
    res.status(400).json({
      message: err,
    });
  }

  try {
    await Subscription.findOneAndRemove(query);
  } catch (err) {
    log.warn('CancelSubscription - error removing subscription', err);
    return res.status(400).json({
      message: err,
    });
  }

  res.status(200);
}

async function create(req, res) {
  const classId = req.params.id;
  const userId = req.ctx.userData.id;
  let course, user, price, instructor, defaultPaymentMethod;

  try {
    course = await Class.findOne({
      id: classId,
    });
  } catch (err) {
    log.warn('CreateSubscription - fetch class error: ', err);
    return res.status(400).json({
      message: err,
    });
  }

  if (!course) {
    log.warn('CreateSubscription - no class data or sku');
    return res.status(404).json({
      message: 'Invalid class data',
    });
  }

  // Get 24 hours before the next class date as a timestamp for invoices to be generated
  const now = new Date();
  const nextDate = utils.getNextDate(c.recurring, 1, now);
  nextDate.setDate(newDate.getDate() - 1);
  const timestamp = nextDate.getTime() / 1000;
  log.debug('Next Timestamp is ', timestamp);

  try {
    instructor = await StripeUser.findOne({
      id: instructor.id
    });
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

  try {
    user = await StripeUser.findOne({
      id: userId
    });
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

  for (var i = 0; i < user.methods.length; i++) {
    if (user.methods[i].default) {
      defaultPaymentMethod = user.methods[i];
      break;
    }
  }

  try {
    price = await utils.getProductPrices(c.product_sku, true);
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

    let data = {
      id: subscription.id,
      classId: classData.id,
      stripeId: user.customerId,
      userId: userId,
    };

    try {
      await Subscription.create(data);
    } catch (err) {
      log.warn('createTransaction - error: ', err);
      return res.status(400).json({
        message: err,
      });
    }

    res.status(200);

  } catch (error) {
    return res.status(402).send({ error: error });
  }
}

module.exports = {
  cancel,
  create
};