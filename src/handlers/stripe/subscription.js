const StripeUser = require('../../db/StripeUser');
const Class = require('../../db/Class');
const Transaction = require('../../db/Transaction');
const Subscription = require('../../db/Subscription');
const User = require('../../db/User');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const log = require('../../log');
const utils = require('../../utils/index');
const fromUnixTime = require('date-fns/fromUnixTime');
const isBefore = require('date-fns/isBefore');
const differenceInDays = require('date-fns/differenceInCalendarDays');

async function createSubscription(req, res) {
  const userData = req.ctx.userData;
  const sku = req.body.sku
  const priceId = req.body.price;

  let stripeUser;

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

  // Validate product is one of ours
  let product;

  try {
    product = await stripe.products.retrieve(sku);
  } catch (err) {
    log.warn("Stripe API error ", err);
    return res.status(500).json({
      message: "Stripe API error"
    })
  }

  if (!product) {
    log.warn("Invalid product sku");
    return res.status(404).json({
      message: "Invalid product sku"
    })
  }

  // Product must have metadata tied to the number of classes for this package
  if (!product.metadata || !product.metadata.max_classes) {
    log.warn("Product has no metadata");
    return res.status(400).json({
      message: "Invalid product metadata"
    })
  }

  // fetch the prices (should be one monthly recurring one but could be more in the future) corresponding to the product they selected 
  let prices;

  try {
    prices = await stripe.prices.list({product: sku});
  } catch (err) {
    log.warn("Stripe API error ", err);
    return res.status(500).json({
      message: "Stripe API Error"
    })
  }

  if (!prices || !prices.data || prices.data.length === 0) {
    log.warn("No prices tied to product");
    return res.status(404).json({
      message: "No prices found"
    })
  }

  const price = prices.data.filter(p => {
    return p.id === priceId;
  });

  if (!price) {
    log.warn("Invalid price");
    return res.status(400).json({
      message: 'Invalid price'
    })
  }

  console.log("PRICE object from prices array: ", price);

  // Check if user has had a subscription before, if not give them free 30 day trial
  let prevSubs;

  try {
    prevSubs = await Subscription.find({ user_id: userData.id });
  } catch (err) {
    log.warn("Database Error finding prev sub ", err);
    return res.status(500).json({
      message: "Database error"
    })
  }

  let freeTrial = false;
  if (!prevSubs || prevSubs.length === 0) {
    freeTrial = true;
  } 
  
  // Make sure there are no active subscriptions already
  if (prevSubs && prevSubs.length > 0) {
    for (let i = 0; i < prevSubs.length; i++) {
      let s = prevSubs[i];
      if (s.status === 'ACTIVE' || s.status === 'TRIAL') {
        log.warn("User has " + s.status + " subscription - can't create another");
        return res.status(400).json({
          message: "You already have an active subscription"
        })
      }
    }
  }

  // create a stripe subscription based on the product the user selected to sign up for
  let stripeSub;
  let options = { 
    customer: stripeUser.customerId,
    items: [
      {price: price.id}
    ]
  };

  if (freeTrial) options.trial_period_days = 30;

  try {
    stripeSub = await stripe.subscriptions.create(options)
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
  let sub;
  options = {
    id: stripeSub.id,
    user_id: userData.id,
    status: freeTrial ? 'TRIAL' : 'CREATED',
    created_date: fromUnixTime(stripeSub.created),
    item: { price: price.id },
    cost: { 
      amount: price.unit_amount,
      recurring: price.recurring
    },
    period_start: fromUnixTime(stripeSub.current_period_start),
    period_end: fromUnixTime(stripeSub.current_period_end),
    classes_left: product.metadata.max_classes,
    max_classes: product.metadata.max_classes
  }

  try {
    sub = Subscription.create(options)
  } catch (err) {
    log.warn("Database error creating our Subscription ", err);
    return res.status(500).json({
      message: "Database Error"
    })
  }

  log.info("Successfully created subscription ", sub);

  return res.status(200).json(sub);
}

// Returns the product and prices data from stripe for frontend consumption
async function getProductsPrices(req, res) {
  let products;

  // Fetch all active products
  try {
    products = await stripe.products.list({ active: true });
  } catch (err) {
    log.error("Stripe API error fetching prodcuts ", err);
    return res.status(500).json({
      message: 'Error fetching prodcuts from stripe'
    })
  }

  if (!products || !products.data || !products.data.length === 0) {
    log.warn("No products found from stripe");
    return res.status(404).json([]);
  }

  let productPrices = []

  // Fetch the pricing data tied to each product
  products.data.forEach(product => {
    let prices;

    try {
      prices = await stripe.prices.list({product: product.id});
    } catch (err) {
      log.warn("Stripe API error fetching prices for product ", err);
      return res.status(500).json({
        message: "Stripe API Error fetching prices "
      })
    }
  
    if (!prices || !prices.data || prices.data.length === 0) {
      log.warn("Invalid price sku - no prices tied to product");
      return res.status(404).json({
        message: "price sku not found"
      })
    }

    // Handle more than one price for product (initially we won't have this but further down the line we may offer yearly, weekly, etc. options)
    const priceData = prices.data.map(price => {
      return {
        id: price.id,
        amount: price.unit_amount,
        recurring: price.recurring 
      }
    });

    productPrices.push({
      product: {
        id: product.id,
        name: product.name,
        description: product.description
      },
      price: priceData
    })
  })

  log.info("Successfully got product and prices ", productPrices);
  res.status(200).json(productPrices);
}

async function cancelSubscription(req, res) {
  const userData = req.ctx.userData;

  // must cancel the user's subscription and remove them from all booked classes (under the sub)
  // refund user based on classes not taken / total classes in subscription * sub cost

  let subs;

  try {
    subs = await Subscription.find({ user_id: userData.id }).sort({ created_date: -1 })
  } catch (err) {
    log.warn("Database error ", err);
    return res.status(500).json({
      message: "Database error"
    })
  }
  
  if (!subs || subs.length === 0) {
    log.warn("User has no subscriptions")
    return res.status(404).json({
      message: "User has no subscriptions"
    })
  }

  let activeSub = subs.filter(sub => {
    return sub.status === "ACTIVE" || sub.status === "TRIAL"
  })

  // Cancel the sub on stripes end
  let cancelled;

  try {
    cancelled = await stripe.subscriptions.del(sub.id);
  } catch (err) {
    log.warn("Stripe API error on subscription delete ", err);
    return res.status(500).json({
      message: 'Stripe API error'
    })
  }
  
  let refund = 0;

  if (activeSub.classes_left < 0) {
    refund = getSubscriptionCostOverDays(activeSub, Date(), activeSub.period_end);
  } else if (activeSub.classes_left > 0) {
    refund = activeSub.classes_left / activeSub.max_classes * activeSub.cost.amount / 100;
  }

  if (refund !== 0) {
    // issue a payment intent refund
    // TODO
    // create Transaction to record it
  }


  // remove user from all future classes
  let classes;
  const now = new Date().toISOString();

  try {
    classes = await Class.updateMany({ participants: userData.id, start_date: { $gte: now } }, { $pull: { participants: userData.id }})
  } catch (err) {
    log.warn("Database error ", err);
    return res.status(500).json({
      message: "Database error"
    })
  }

  // update subscription to CANCELLED
  try {
    await Subscription.update({ id: activeSub.id }, { $set: { status: 'CANCELLED' }});
  } catch (err) {
    log.warn("Database error ", err);
    return res.status(500).json({
      message: "Database error"
    })
  }

  res.status(200).json({
    message: 'Subscription cancelled'
  })
}

// Returns cost of the subscription over the number of days it was active between startDate and endDate
function getSubscriptionCostOverDays(sub, startDate, endDate) {
  console.log("Sub start ", sub.period_start)
  console.log("Sub end ", sub.period_end)
  console.log("Compare start ", startDate);
  console.log("Compare end ", endDate);

  const totalDays = differenceInDays(sub.period_start, sub.period_end);
  const cost = sub.cost.amount / 100;
  let daysInRange = 0;

  if (isBefore(sub.period_start, startDate)) {
    // get full days diff from start date to period end or end date whichever is closer
    if (isBefore(sub.period_end, endDate)) {
      daysInRange = differenceInDays(startDate, sub.period_end);
    } else {
      daysInRange = differenceInDays(startDate, endDate);
    }
  } else {
    // get days diff from period start to period end or end date whichever is closer
    if (isBefore(sub.period_end, endDate)) {
      daysInRange = differenceInDays(sub.period_start, sub.period_end);
    } else {
      daysInRange = differenceInDays(sub.period_start, endDate);
    }
  }

  return daysInRange / totalDays * cost;
}

// Fetch user subscription data from mongo - returns latest subscription if multiple exist
async function getSubscription(req, res) {
  const userData = req.ctx.userData;

  let sub;

  try {
    sub = Subscription.find({ user_id: userData.id })
  } catch (err) {
    log.warn("Database error fetching user subs ", err);
    return res.status(500).json({
      message: "Database error"
    })
  }

  let s = null;

  if (sub.length > 0) {
    s = sub[0];
  }

  log.info("Found user sub data ", s);
  res.status(200).json(s);
}

async function subscriptionWebhook(req, res) {

  // Handle setting subscription status based on invoices paid/failed - see current webhook for stripe

}

module.exports = {
  createSubscription,
  getProductsPrices,
  cancelSubscription,
  getSubscription,
  subscriptionWebhook
}