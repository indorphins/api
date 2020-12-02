const StripeUser = require('../../db/StripeUser');
const Class = require('../../db/Class');
const Transaction = require('../../db/Transaction');
const Subscription = require('../../db/Subscription');
const User = require('../../db/User');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const log = require('../../log');
const utils = require('../../utils/index');

async function createSubscription(req, res) {
  const userData = req.ctx.userData;
  const sku = req.params.sku

  let stripeUser;

  // fetch the stripe user and 

  try {
    stripeUser = await StripeUser.findOne({ id: userData.id })
  } catch (err) {
    log.warn("Database error ", err);
    return res.status(500).json({
      message: "Database Error"
    })
  }

  if (!stripeUser || !stripeUser.customerId) {
    log.warn("No stripe user found to create subscription for");
    return res.status(404).json({
      message: "No valid stripe user found to create subscription"
    })
  }

  // fetch the price id corresponding to the product they selected 

  let price;

  try {
    price = await stripe.prices.retrieve(sku);
  } catch (err) {
    log.warn("Stripe API error ", err);
    return res.status(500).json({
      message: "Stripe API Error"
    })
  }

  if (!price || !price.id) {
    log.warn("Invalid price sku");
    return res.status(404).json({
      message: "price sku not found"
    })
  }

  // create a stripe subscription based on the product the user selected to sign up for
  // Need the price id of the recurring 
  let stripeSub;

  try {
    stripeSub = await stripe.subscriptions.create({ 
      customer: stripeUser.customerId,
      items: [
        {price: price.id}
      ]
    })
  } catch (err) {
    log.warn("Stripe API error on subscription creation ", err);
    return res.status(500).json({
      message: "Stripe API error"
    })
  }

  if (!stripeSub) {
    // Would need to handle cancelling the sub - but this case shouldn't ever happen and we can likely remove
    log.warn("Subscription not returned ", err);
    return res.status(404).json({
      message: "Subscription not returned"
    })
  }

  // Create our own subscription object in our db
  // TODO status - normalize across flow
  let sub;
  const options = {
    id: stripeSub.id,
    user_id: userData.id,
    status: 'CREATED',
    created_date: new Date(),
    item: { price: price.id },
    cost: { 
      amount: price.unit_amount,
      recurring: price.recurring
    }
  }

  try {
    sub = Subscription.create(options)
  } catch (err) {
    log.warn("Database error creating our Subscription ", err);
    return res.status(500).json({
      message: "Database Error"
    })
  }

  return res.status(200).json({
    message: 'Subscription Created'
  });
}

async function getInstructorsSubShare(instructorId, startDate, endDate) {

  // Instructors get a share equal to the number of spots booked in classes hosted between start and end date 
  // DIVIDED BY the total number of spots booked in all classes over that time
  // TIMES the amount of subscription money generated during that time allotted for instructors (80%)

}

async function payoutInstructor(instructorId) {

  // Use Stripe api to make direct payment from our company stripe account
  // to the instuctor's connected account for their share

}

async function cancelSubscription(req, res) {

  // must cancel the user's subscription and remove them from all booked classes (under the sub)
  // refund user based on classes not taken / total classes in subscription * sub cost
  
}

async function subscriptionWebhook(req, res) {

  // Handle setting subscription status based on invoices paid/failed - see current webhook for stripe

}