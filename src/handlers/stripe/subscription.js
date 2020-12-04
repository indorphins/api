const StripeUser = require('../../db/StripeUser');
const Class = require('../../db/Class');
const Transaction = require('../../db/Transaction');
const Subscription = require('../../db/Subscription');
const User = require('../../db/User');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const log = require('../../log');
const utils = require('../../utils/index');
const fromUnixTime = require('date-fns/fromUnixTime');

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
  let prevSub;

  try {
    prevSub = await Subscription.find({ user_id: userData.id });
  } catch (err) {
    log.warn("Database Error finding prev sub ", err);
    return res.status(500).json({
      message: "Database error"
    })
  }

  let freeTrial = false;
  if (!prevSub || prevSub.length === 0) {
    freeTrial = true;
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
    period_end: fromUnixTime(stripeSub.current_period_end)
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

  // must cancel the user's subscription and remove them from all booked classes (under the sub)
  // refund user based on classes not taken / total classes in subscription * sub cost
  
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