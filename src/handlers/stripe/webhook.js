const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Subscription = require('../../db/Subscription');
const Transaction = require('../../db/Transaction');
const Class = require('../../db/Class');
const log = require('../../log');
const fromUnixTime = require('date-fns/fromUnixTime');

/**
 * Webhook for stripe handling invoice events
 * Receives an event and the relevant data object
 * Anything higher than a 2XX response will cause the event to be repeated
 * @param {Object} req
 * @param {Object} res
 */
async function invoiceWebhook(req, res) {

  let b = req.body;
  let sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(b, sig, process.env.STRIPE_WEBHOOK_SECRET);
    log.info('Stripe webhook event: ', event);
  } catch (err) {
    log.warn('Stripe Webhook error constructing event: ', err);
    return res.sendStatus(400);
  }
  const dataObject = event.data.object;
  let sub;

  if (event.type === 'invoice.paid' && dataObject.amount_paid > 0) {
    // update period start and end dates as well as status to ACTIVE
    try {
      sub = await Subscription.findOne({ id: dataObject.subscription });
    } catch (err) {
      log.warn("Database error in webhook ", err)
      return res.sendStatus(500);
    }

    if (!sub) {
      log.warn("No subscription found for webhook invoice.paid ", dataObject.subscription);
      return res.sendStatus(404);
    }

    sub.status = 'ACTIVE';
    sub.latest_payment = dataObject.payment_intent;

    try {
      await Subscription.updateOne({ id: sub.id }, sub)
    } catch (err) {
      log.warn("Database error in webhook ", err)
      return res.sendStatus(500);
    }

    // Create a Transaction to document invoice paid
    let transaction;
    let options = {
      userId: sub.user_id,
      amount: dataObject.amount_paid,	
      subscriptionId: sub.id,
      type: 'debit',
      status: dataObject.status,
      paymentId: dataObject.payment_intent,
      created_date: new Date().toISOString()
    }
    try {
      transaction = await Transaction.create(options);
    } catch (err) {
      log.warn("Database error with webhook ", err);
      return res.sendStatus(500);
    }

    log.info("Webook - invoice.paid - created Transaction ", transaction);
  }

  if (
    event.type === 'invoice.payment_failed' ||
    event.type === 'invoice.voided' ||
    event.type === 'invoice.marked_uncollectible'
  ) {
    // the invoice.payment_failed chain of events does eventually trigger invoice.marked_uncollectible
    // Mark the user's subscription as PAYMENT_FAILED - no refund flow needed here 
    try {
      sub = await Subscription.findOne({ id: dataObject.subscription });
    } catch (err) {
      log.warn("Database error in webhook ", err)
      return res.sendStatus(500);
    }

    if (sub) {
      sub.status = 'PAYMENT_FAILED';
      sub.canceled_date = new Date().toISOString();

      try {
        await Subscription.updateOne({ id: sub.id }, sub)
      } catch (err) {
        log.warn("Database error in webhook ", err)
        return res.sendStatus(500);
      }
    } else {
      log.info("Webhook - invoice failed but no subscription tied to it ", dataObject);
    }
  }

  if (event.type === 'customer.subscription.updated') {
    try {
      sub = await Subscription.findOne({ id: dataObject.id });
    } catch (err) {
      log.warn("Database error in webhook ", err)
      return res.sendStatus(500);
    }

    if (!sub) {
      log.warn("No subscription found for webhook customer.subscription.updated ", dataObject);
      return res.sendStatus(404);
    }

    sub.period_start = fromUnixTime(dataObject.current_period_start).toISOString();
    sub.period_end = fromUnixTime(dataObject.current_period_end).toISOString();

    if (dataObject.status === 'active') {
      sub.status = 'ACTIVE';
    } 
    if (dataObject.status === 'trialing') {
      sub.status = 'TRIAL';
    }
    if (dataObject.status === 'canceled') {
      // remove user from all future classes
      try {
        sub = await Subscription.findOne({ id: dataObject.id });
      } catch (err) {
        log.warn("Database error in webhook ", err)
        return res.sendStatus(200);
      }

      const nowDate = new Date().toISOString();
      const userId = sub.user_id;

      try {
        await Class.updateMany({ 'participants.id': userId, start_date : { $gte: nowDate }}, { $pull: { participants: { id: userId } }});
      } catch (err) {
        log.warn("Database error ", err);
        return res.status(500).json({
          message: "Database error"
        })
      }

      // update subscription to CANCELED
      sub.status = 'CANCELED';
      sub.canceled_date = new Date().toISOString();

      try {
        await Subscription.updateOne({ id: sub.id }, sub);
      } catch (err) {
        log.warn("Database error ", err);
        return res.status(500).json({
          message: "Database error"
        })
      }

      let options = {
        userId: userId,
        status: 'canceled subscription',
        subscriptionId: sub.id,
        created_date: new Date().toISOString()
      }

      try {
        await Transaction.create(options);
      } catch (err) {
        log.warn("Error creating transaction for subscription cancellation ", err);
      }
      return res.sendStatus(200);
    }

    try {
      await Subscription.updateOne({ id: sub.id }, sub)
    } catch (err) {
      log.warn("Database error in webhook ", err)
      return res.sendStatus(500);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    // remove user from all future classes
    try {
      sub = await Subscription.findOne({ id: dataObject.id });
    } catch (err) {
      log.warn("Database error in webhook ", err)
      return res.sendStatus(200);
    }

    const nowDate = new Date().toISOString();
    const userId = sub.user_id;

    try {
      await Class.updateMany({ 'participants.id': userId, start_date : { $gte: nowDate }}, { $pull: { participants: { id: userId } }});
    } catch (err) {
      log.warn("Database error ", err);
      return res.status(500).json({
        message: "Database error"
      })
    }

    // update subscription to CANCELED
    sub.status = 'CANCELED';
    sub.canceled_date = new Date().toISOString();

    try {
      await Subscription.updateOne({ id: sub.id }, sub);
    } catch (err) {
      log.warn("Database error ", err);
      return res.status(500).json({
        message: "Database error"
      })
    }

    let options = {
      userId: userId,
      status: 'canceled subscription',
      subscriptionId: sub.id,
      created_date: new Date().toISOString()
    }

    try {
      await Transaction.create(options);
    } catch (err) {
      log.warn("Error creating transaction for subscription cancellation ", err);
    }
    return res.sendStatus(200);
  }

  res.sendStatus(200);
}

/**
 * Same as prod webhook but always returns 200 status
 * @param {Object} req
 * @param {Object} res
 */
async function devWebhook(req, res) {

  let b = req.body;
  let sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(b, sig, process.env.STRIPE_WEBHOOK_SECRET);
    log.info('Stripe webhook event: ', event);
  } catch (err) {
    log.warn('Stripe Webhook error constructing event: ', err);
    return res.sendStatus(400);
  }
  const dataObject = event.data.object;
  let sub;

  if (event.type === 'invoice.paid' && dataObject.amount_paid > 0) {
    // update period start and end dates as well as status to ACTIVE
    try {
      sub = await Subscription.findOne({ id: dataObject.subscription });
    } catch (err) {
      log.warn("Database error in webhook ", err)
      return res.sendStatus(200);
    }

    if (!sub) {
      log.warn("No subscription found for webhook invoice.paid ", dataObject.subscription);
      return res.sendStatus(200);
    }

    sub.status = 'ACTIVE';
    sub.latest_payment = dataObject.payment_intent;

    try {
      await Subscription.updateOne({ id: sub.id }, sub)
    } catch (err) {
      log.warn("Database error in webhook ", err)
      return res.sendStatus(200);
    }

    // Create a Transaction to document invoice paid
    let transaction;
    let options = {
      userId: sub.user_id,
      amount: dataObject.amount_paid,	
      subscriptionId: sub.id,
      type: 'debit',
      status: dataObject.status,
      paymentId: dataObject.payment_intent,
      created_date: new Date().toISOString()
    }
    try {
      transaction = await Transaction.create(options);
    } catch (err) {
      log.warn("Database error with webhook ", err);
      return res.sendStatus(200);
    }

    log.info("Webook - invoice.paid - created Transaction ", transaction);
  }

  if (
    event.type === 'invoice.payment_failed' ||
    event.type === 'invoice.voided' ||
    event.type === 'invoice.marked_uncollectible'
  ) {
    // the invoice.payment_failed chain of events does eventually trigger invoice.marked_uncollectible
    // Mark the user's subscription as PAYMENT_FAILED - no refund flow needed here 
    try {
      sub = await Subscription.findOne({ id: dataObject.subscription });
    } catch (err) {
      log.warn("Database error in webhook ", err)
      return res.sendStatus(200);
    }

    if (sub) {
      sub.status = 'PAYMENT_FAILED';
      sub.canceled_date = new Date().toISOString();

      try {
        await Subscription.updateOne({ id: sub.id }, sub)
      } catch (err) {
        log.warn("Database error in webhook ", err)
        return res.sendStatus(200);
      }
    } else {
      log.info("Webhook - invoice failed but no subscription tied to it ", dataObject);
    }
  }

  if (event.type === 'customer.subscription.updated') {
    try {
      sub = await Subscription.findOne({ id: dataObject.id });
    } catch (err) {
      log.warn("Database error in webhook ", err)
      return res.sendStatus(200);
    }

    if (!sub) {
      log.warn("No subscription found for webhook customer.subscription.updated ", dataObject);
      return res.sendStatus(200);
    }

    sub.period_start = fromUnixTime(dataObject.current_period_start).toISOString();
    sub.period_end = fromUnixTime(dataObject.current_period_end).toISOString();

    if (dataObject.status === 'active') {
      sub.status = 'ACTIVE';
    } 
    if (dataObject.status === 'trialing') {
      sub.status = 'TRIAL';
    }
    if (dataObject.status === 'canceled') {
      // remove user from all future classes
      try {
        sub = await Subscription.findOne({ id: dataObject.id });
      } catch (err) {
        log.warn("Database error in webhook ", err)
        return res.sendStatus(200);
      }

      const nowDate = new Date().toISOString();
      const userId = sub.user_id;

      try {
        await Class.updateMany({ 'participants.id': userId, start_date : { $gte: nowDate }}, { $pull: { participants: { id: userId } }});
      } catch (err) {
        log.warn("Database error ", err);
        return res.status(500).json({
          message: "Database error"
        })
      }

      // update subscription to CANCELED
      sub.status = 'CANCELED';
      sub.canceled_date = new Date().toISOString();

      try {
        await Subscription.updateOne({ id: sub.id }, sub);
      } catch (err) {
        log.warn("Database error ", err);
        return res.status(500).json({
          message: "Database error"
        })
      }

      let options = {
        userId: userId,
        status: 'canceled subscription',
        subscriptionId: sub.id,
        created_date: new Date().toISOString()
      }

      try {
        await Transaction.create(options);
      } catch (err) {
        log.warn("Error creating transaction for subscription cancellation ", err);
      }
      return res.sendStatus(200);
    }

    try {
      await Subscription.updateOne({ id: sub.id }, sub)
    } catch (err) {
      log.warn("Database error in webhook ", err)
      return res.sendStatus(200);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    // remove user from all future classes
    try {
      sub = await Subscription.findOne({ id: dataObject.id });
    } catch (err) {
      log.warn("Database error in webhook ", err)
      return res.sendStatus(200);
    }

    const nowDate = new Date().toISOString();
    const userId = sub.user_id;

    try {
      await Class.updateMany({ 'participants.id': userId, start_date : { $gte: nowDate }}, { $pull: { participants: { id: userId } }});
    } catch (err) {
      log.warn("Database error ", err);
      return res.status(500).json({
        message: "Database error"
      })
    }

    // update subscription to CANCELED
    sub.status = 'CANCELED';
    sub.canceled_date = new Date().toISOString();

    try {
      await Subscription.updateOne({ id: sub.id }, sub);
    } catch (err) {
      log.warn("Database error ", err);
      return res.status(500).json({
        message: "Database error"
      })
    }

    let options = {
      userId: userId,
      status: 'canceled subscription',
      subscriptionId: sub.id,
      created_date: new Date().toISOString()
    }

    try {
      await Transaction.create(options);
    } catch (err) {
      log.warn("Error creating transaction for subscription cancellation ", err);
    }
    return res.sendStatus(200);
  }

  res.sendStatus(200);
}

module.exports = {
  invoiceWebhook,
  devWebhook
}