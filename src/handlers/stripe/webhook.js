const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Subscription = require('../../db/Subscription');
const Transaction = require('../../db/Transaction');
const StripeUser = require('../../db/StripeUser');
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
    log.warn('Stripe Webhook error: ', err);
    return res.sendStatus(400);
  }
  const dataObject = event.data.object;
  let sub;

  if (event.type === 'invoice.paid') {
    // update period start and end dates as well as status to ACTIVE
    try {
      sub = await Subscription.findOne({ id: dataObject.subscription });
    } catch (err) {
      log.warn("Database error in webhook ", err)
      return res.sendStatus(500);
    }

    sub.status = 'ACTIVE';
    sub.period_start = fromUnixTime(dataObject.period_start).toISOString();
    sub.period_end = fromUnixTime(dataObject.period_end).toISOString();
    sub.latest_payment = dataObject.payment_intent;

    try {
      await Subscription.updateOne({ id: sub.id }, sub)
    } catch (err) {
      log.warn("Database error in webhook ", err)
      return res.sendStatus(500);
    }
  }

  if (
    event.type === 'invoice.payment_failed' ||
    event.type === 'invoice.voided' ||
    event.type === 'invoice.marked_uncollectible'
  ) {
    // Mark the user's subscription as PAYMENT_FAILED - no refund flow needed here 
    try {
      sub = await Subscription.findOne({ id: dataObject.subscription });
    } catch (err) {
      log.warn("Database error in webhook ", err)
      return res.sendStatus(500);
    }

    sub.status = 'PAYMENT_FAILED';
    
    try {
      await Subscription.updateOne({ id: sub.id }, sub)
    } catch (err) {
      log.warn("Database error in webhook ", err)
      return res.sendStatus(500);
    }
  }

  res.sendStatus(200);
}

module.exports = {
  invoiceWebhook,
}