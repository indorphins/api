const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Takes in a class ID and cancels the stripe subscription for a user in the class
 * Updates the transaction associated with the subscription as well
 * @param {Object} req
 * @param {Object} res
 */
export async function cancel(req, res) {
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

export async function create(req, res) {
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
      stripeId: user.customerId
    };

    next();
  } catch (error) {
    return res.status(402).send({ error: error });
  }
}