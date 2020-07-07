const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Subscription = require('../../db/Subscription');
const Transaction = require('../../db/Transaction');
const StripeUser = require('../../db/StripeUser');
const Class = require('../../db/Class');
const log = require('../../log');

/**
 * Webhook for stripe handling invoice events
 * Receives an event and the relevant data object
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

  if (event.type === 'invoice.paid') {
    return updateInvoiceStatus(dataObject)
      .then((transaction) => {
        // No need to add user to recurring class as they will be in it after the first one-time payment
        // TODO maybe notify them here of upcoming class
        return res.sendStatus(200)
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
    // Update invoice and delete subscription on invoice failure and remove from class
    return updateInvoiceStatus(dataObject)
      .then((transaction) => {
        return removeUserFromClass(
          dataObject.metadata.class_id,
          dataObject.customer
        ).then((result) => {
          // TODO notify user of failed invoice
          return stripe.subscriptions.del(dataObject.subscription);
        }).then((deletedSub) => {
          return deleteSubscription(deletedSub);
        }).then(() => {
          return res.status(200).json({
            message: 'Invoice Failed - Cancelled Subscription',
          });
        }
        );
      })
      .catch((error) => {
        log.warn('Stripe Webhook error - invoice.payment_failed - ', error);
        return res.status(400).json({
          message: error,
        });
      });
  }
  res.sendStatus(200);
}

/**
 * Delete the subscription record in mongo
 * @param {Object} subscription
 */
async function deleteSubscription(subscription) {
  let query = {
    id: subscription.id,
  };

  try {
    await Subscription.findOneAndRemove(query);
  } catch (err) {
    log.warn('CancelSubscription - error removing subscription', err);
    throw err;
  }
}

/**
 * Updates a transaction status
 * Creates a transaction if one doesn't already exist
 * Returns the updated transaction
 * @param {Object}
 */
async function updateInvoiceStatus(invoice) {
  let query = {
    paymentId: invoice.id,
  };
  let transaction;
  try {
    transaction = await Transaction.findOneAndUpdate(query, {
      status: invoice.status,
    });
  } catch (err) {
    log.warn('updateInvoiceStatus - update transaction error: ', error);
    throw err;
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
      throw err;
    }
    let data = {
      classId: invoice.metadata.class_id,
      userId: user.id,
      stripeId: invoice.customer,
      paymentId: invoice.id,
      subscriptionId: invoice.subscription,
      status: invoice.status,
      type: 'debit',
      created_date: new Date().toISOString()
    };
    try {
      transaction = await Transaction.create(data);
    } catch (err) {
      log.warn('updateInvoiceStatus - error creating transaction ', err);
      throw err;
    }
  }

  return transaction;
}

/**
 * Removes a user from a class' participants array
 * Called after failed payment of participant for class
 * Returns the Class
 * @param {String} classId
 * @param {String} stripeId
 * @returns {Object}
 */
async function removeUserFromClass(classId, stripeId) {

  let query = {
    customerId: stripeId,
  };
  let user;

  try {
    user = await StripeUser.findOne(query);
  } catch (err) {
    log.warn('removeUserFromClass find stripe user error: ', err);
    throw err;
  }

  if (!user) {
    log.warn('removeUserFromClass no stripe user found');
    throw Error("No stripe user found")
  }

  let c;

  try {
    c = await Class.findOne({ id: classId });
  } catch (err) {
    log.warn("database error", err);
    throw err
  }

  if (!c) {
    log.warn('removeUserFromClass no class found');
    throw Error("No class found")
  }

  let index = -1;
  for (var i = 0; i < c.participants.length; i++) {
    if (c.participants[i].id == user.id) {
      index = i;
    }
  }

  if (index == -1) {
    return c;
  }

  c.participants.splice(index, 1);
  c.available_spots = c.available_spots + 1;

  try {
    await Class.updateOne({ id: classId }, c);
  } catch (err) {
    log.warn('removeUserFromClass remove user from class error: ', err);
    throw err;
  }

  return c;
}

module.exports = {
  invoiceWebhook,
}