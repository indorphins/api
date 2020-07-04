const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Webhook for stripe event handling
 * receives an event and the relevant payment object
 * @param {Object} req
 * @param {Object} res
 */
export async function invoiceWebhook(req, res) {
  // Retrieve the event by verifying the signature using the raw body and secret.

  let b  = req.body;
  let sig = req.headers['stripe-signature'];

  //log.debug('Stripe webhook event', b, sig);

  let event;
  try {
    event = stripe.webhooks.constructEvent(b, sig, "whsec_sQsxXCo7HSpX2QWrJK6Sge3LqnFskTvh");
    log.info('Stripe webhook event: ', event);
  } catch (err) {
    log.warn('Stripe Webhook error: ', err);
    return res.sendStatus(400);
  }
  const dataObject = event.data.object;

  log.debug("DATA object", dataObject);

  /*if (event.type === 'invoice.payment_succeeded') {
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
  }*/
  res.sendStatus(200);
}

/**
 * Updates a subscription transaction status with input status string
 * If there's no subscription transaction create one
 * Returns the updated subscription transaction
 * TODO could dry this up with updateInvoiceStatus
 * @param {Object}
 * @param {String} status
 */
export async function updateSubscriptionStatus(subscription, status) {
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
 * Updates a transaction status with input status string
 * Creates a transaction if one doesn't already exist
 * Returns the updated transaction
 * @param {Object}
 * @param {String} status
 */
export async function updateInvoiceStatus(invoice, status) {
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
