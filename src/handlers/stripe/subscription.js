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
const unlimitedSubscriptionSku = process.env.UNLIMITED_SUB_SKU
const uuid = require('uuid');

async function createSubscription(req, res) {
  const userData = req.ctx.userData;
  const sku = req.body.sku;
  const priceId = req.body.price;

  // Check if user has had a subscription before, if not give them free 14 day trial
  // If they have an active sub don't let them create another
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
  // if there are and they're set to cancel at period end, resume it
  if (prevSubs && prevSubs.length > 0) {
    for (let i = 0; i < prevSubs.length; i++) {
      let s = prevSubs[i];
      if (s.status === 'ACTIVE' || s.status === 'TRIAL') {
        if (s.cancel_at_period_end) {
          log.info("User ", userData.id, " has existing sub - resume rather than create ", s);
          // Update via stripe their existing sub to not cancel
          try {
            await stripe.subscriptions.update(s.id, {
              cancel_at_period_end: false
            });
          } catch (err) {
            log.warn("Stripe API error on subscription update to resume ", err);
            return res.status(500).json({
              message: 'Stripe API error'
            })
          }

          s.cancel_at_period_end = false;

          try {
            await Subscription.updateOne({ id: s.id }, s);
          } catch (err) {
            log.warn("Error resuming sub update call ", err);
          }

          log.info("Successfully resumed subscription");
          return res.status(200).json(s);
        }

        log.warn("User has " + s.status + " subscription - can't create another");
        return res.status(400).json({
          message: "You already have an active subscription"
        })
      }
    }
  }

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

  let stripeSub, price, product;

  if (userData.type === 'standard') {
    // Validate product is one of ours
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
    if (!product.metadata || !product.metadata.max_classes || !product.metadata.trial_length) {
      log.warn("Product has no metadata or missing max_classes or trial_length properties");
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

    price = prices.data.filter(p => {
      return p.id === priceId;
    });

    if (!price || price.length === 0) {
      log.warn("Invalid price");
      return res.status(400).json({
        message: 'Invalid price'
      })
    }

    price = price[0];

    // create a stripe subscription based on the product the user selected to sign up for
    let options = { 
      customer: stripeUser.customerId,
      items: [
        {price: price.id}
      ],
      proration_behavior: 'none',
      payment_behavior: 'error_if_incomplete',
      collection_method: 'charge_automatically'
    };

    if (freeTrial) options.trial_period_days = parseInt(product.metadata.trial_length);

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
  }

  log.debug("Created stripe subscription ", stripeSub);

  // Create our own subscription object in our db
  const now = new Date().toISOString();

  if (stripeSub) {
    options = {
      id: stripeSub.id,
      user_id: userData.id,
      status: freeTrial ? 'TRIAL' : 'ACTIVE',
      created_date: fromUnixTime(stripeSub.created).toISOString(),
      item: { price: price.id },
      cost: { 
        amount: price.unit_amount,
        recurring: price.recurring
      },
      period_start: fromUnixTime(stripeSub.current_period_start).toISOString(),
      period_end: fromUnixTime(stripeSub.current_period_end).toISOString(),
      classes_left: product.metadata.max_classes,
      max_classes: product.metadata.max_classes,
      trial_length: parseInt(product.metadata.trial_length),
      cancel_at_period_end: false
    }
  } else {
    // Arbitrary end date of 01-01-2024
    options = {
      id: uuid.v1(),
      user_id: userData.id,
      status: 'ACTIVE',
      created_date: now,
      item: {},
      cost: { 
        amount: 0,
      },
      period_start: now,
      period_end: fromUnixTime(1704067200).toISOString(),
      classes_left: -1,
      max_classes: -1,
      trial_length: 0,
      cancel_at_period_end: false
    }
  }
  let sub;

  try {
    sub = await Subscription.create(options)
  } catch (err) {
    log.warn("Database error creating our Subscription ", err);
    return res.status(500).json({
      message: "Database Error"
    })
  }

  options = {
    userId: userData.id,
    status: 'created subscription',
    subscriptionId: sub.id,
    created_date: now
  }

  try {
    await Transaction.create(options);
  } catch (err) {
    log.warn("Error creating transaction for subscription creation ", err);
  }

  log.info("Successfully created subscription ", sub);

  return res.status(200).json(sub);
}

// Returns the product and prices data for our unlimited subscriptoin from stripe for frontend consumption
async function getUnlimitedSubProduct(req, res) {
  let products;

  log.debug("getUnlimitedSubProduct - fetch stripe product ", unlimitedSubscriptionSku);
  // Fetch all active products
  try {
    products = await stripe.products.retrieve(unlimitedSubscriptionSku);
  } catch (err) {
    log.error("Stripe API error fetching prodcuts ", err);
    return res.status(500).json({
      message: 'Error fetching prodcuts from stripe'
    })
  }

  log.debug("getUnlimitedSubProduct - Got products from stripe ", products);

  if (!products) {
    log.warn("No products found from stripe");
    return res.status(404).json({});
  }

  products = [products];

  let productPrices = {}

  // Fetch the pricing data tied to each product
  await utils.asyncForEach(products, async (product) => {
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

    let trialLength = 0;

    if (product.metadata && product.metadata.trial_length) {
      trialLength = parseInt(product.metadata.trial_length);
    }

    productPrices = {
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        trial_length: trialLength
      },
      price: priceData
    }
  })

  log.info("Successfully got product and prices ", productPrices);
  res.status(200).json(productPrices);
}

// *** This method no longer populates the refund property in req.ctx since refunds are deprecated for subscriptions
// rather it finds a valid subscription that can be canceled and puts it in req.ctx.activeSub
async function getRefundAmount(req, res, next) {
  // refund user based on classes not taken / total classes in subscription * sub cost
  const userData = req.ctx.userData;
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

  let activeSubs = subs.filter(sub => {
    return sub.status === "ACTIVE" || sub.status === 'TRIAL';
  })

  if (activeSubs.length === 0) {
      log.warn('User has no active subscriptions');
      return res.status(404).json({
        message: 'User has no active subscriptions'
      })
  }

  //   activeSubs = subs.filter(sub => {
  //     return sub.status === "TRIAL"
  //   })

  //   if (activeSubs.length > 0) {
  //     let activeSub = activeSubs[0];

  //     req.ctx.refund = 0;
  //     req.ctx.activeSub = activeSub;
    
  //     return next();
  //   } else {
  //     log.warn('User has no active subscriptions');
  //     return res.status(404).json({
  //       message: 'User has no active subscriptions'
  //     })
  //   }
  // } 

  let activeSub = activeSubs[0];
  let refund = 0;

  req.ctx.refund = 0;
  req.ctx.activeSub = activeSub;

  return next();

  // if (activeSub.classes_left < 0) {
  //   const start = new Date();
  //   const end = new Date(activeSub.period_end);
  //   refund = getSubscriptionCostOverDays(activeSub, start, end);
  // } else if (activeSub.classes_left > 0) {
  //   refund = activeSub.classes_left / activeSub.max_classes * activeSub.cost.amount;
  // }

  // req.ctx.refund = refund;
  // req.ctx.activeSub = activeSub;

  // next();
}

async function cancelSubscription(req, res) {
  // must cancel the user's subscription and remove them from all booked classes (under the sub)
  // refund user based on classes not taken / total classes in subscription * sub cost

  const userData = req.ctx.userData;
  const activeSub = req.ctx.activeSub;
  let refund = req.ctx.refund;

  if (!activeSub) {
    log.warn("No subscription to cancel");
    return res.status(404).json({
      message: "No subscription to cancel"
    })
  }

  if (!refund) refund = 0;

  if (userData.type === 'standard') {

    // Update the sub to cancel on period end
    try {
      await stripe.subscriptions.update(activeSub.id, {
        cancel_at_period_end: true
      });
    } catch (err) {
      log.warn("Stripe API error on subscription update to cancel ", err);
      return res.status(500).json({
        message: 'Stripe API error'
      })
    }

    // If no payment to refund there should be no refund
    // Occurs in the hour after the trial ends before the invoice is finalized but
    // the subscription is marked ACTIVE
    // if (!activeSub.latest_payment) {
    //   refund = 0;
    // }

    // if (refund > 0 && activeSub.latest_payment) {
    //   // issue a payment intent refund using latest_payment
    //   let refundTransaction;
    //   try {
    //     refundTransaction = await stripe.refunds.create({
    //       payment_intent: activeSub.latest_payment,
    //       amount: refund
    //     });
    //   } catch (err) {
    //     log.warn('Stripe - create refund error: ', err);
    //     let re = /is already fully reversed/g
    //     if (!err.message.match(re)) {
    //       return res.status(400).json({
    //         message: err.message,
    //       });
    //     }
    //   }

    //   log.debug("Issued stripe refund for subscription ", refundTransaction);

    //   if (refundTransaction) {
    //     try {
    //       await Transaction.create({
    //         amount: refund,
    //         paymentId: refundTransaction.id,
    //         userId: userData.id,
    //         status: refundTransaction.status,
    //         type: 'credit',
    //         subscriptionId: activeSub.id,
    //         created_date: new Date().toISOString()
    //       });
    //     } catch (err) {
    //       return res.status(500).json({
    //         message: err.message
    //       });
    //     }
    //   }
    // }
  }

  activeSub.cancel_at_period_end = true;

  try {
    await Subscription.updateOne({ id: activeSub.id }, activeSub);
  } catch (err) {
    log.warn("Database error updating sub ", err);
  }

  res.status(200).json({
    sub: activeSub,
    refund: refund
  });
}

// Returns cost IN CENTS of the subscription over the number of days it was active between startDate and endDate
function getSubscriptionCostOverDays(sub, startDate, endDate) {
  if (sub.cost && sub.cost.amount === 0) {
    return 0;
  }

  const cost = sub.cost.amount;
  const start = new Date(sub.period_start);
  const end = new Date(sub.period_end);
  let totalDays = differenceInDays(sub.period_end, sub.period_start);
  let daysInRange = 0;

  if (isBefore(start, startDate)) {
    // get days diff from start date to period end or end date whichever is closer
    if (isBefore(end, endDate)) {
      daysInRange = differenceInDays(end, startDate);
    } else {
      daysInRange = differenceInDays(endDate, startDate);
    }
  } else {
    // get days diff from period start to period end or end date whichever is closer
    if (isBefore(end, endDate)) {
      daysInRange = differenceInDays(end, start);
    } else {
      daysInRange = differenceInDays(endDate, start);
    }
  }

  if (daysInRange === 0) daysInRange = 1;
  if (totalDays === 0) totalDays = 1;

  return Math.round(daysInRange / totalDays * cost);
}

// Fetch user subscription data from mongo - returns latest subscription if multiple exist
async function getSubscription(req, res) {
  const userData = req.ctx.userData;

  let sub;

  try {
    sub = await Subscription.find({ user_id: userData.id }).sort({ created_date: -1 })
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

/**
 * Checks if user has an active or trial subscription
 * If they have classes left in their sub add to the class 
 * Replaces create transaction
 * @param {Object} req 
 * @param {Object} res 
 */
async function addUserToClass(req, res) {
  const userData = req.ctx.userData;
  const userType = userData.type;
  const userId = userData.id;
  const classId = req.params.id;

  let course;

  try {
    course = await Class.findOne({ id: classId });
  } catch (err) {
    log.warn("Database error");
    return res.status(500).json({
      message: 'Database error'
    })
  }

  if (!course) {
    log.warn("No class found to add user to");
    return res.status(404).json({
      message: 'No class found by id'
    })
  }

  if (course.participants.indexOf(userId) >= 0) {
    log.info("User already in class");
    return res.status(400).json({
      message: "User already booked in class"
    })
  }

  if (course.available_spots <= 0) {
    log.info("Class full");
    return res.status(400).json({
      message: "Class full"
    })
  }

  let subs;

  try {
    subs = await Subscription.find({ $and: [{user_id: userId} , { $or : [{status: 'ACTIVE'}, {status: 'TRIAL'}]}]}).sort({ created_date: -1 });
  } catch (err) {
    log.warn("Database error ", err);
    return res.status(500).json({
      message: "Database err"
    })
  }

  if (!subs || subs.length === 0) {
    log.warn("No subscriptions found");
    return res.status(404).json({
      message: 'No subscriptions found'
    })
  }

  const sub = subs[0];

  if (sub.classes_left === 0) {
    log.warn("No more classes left in subscription");
    return res.status(400).json({
      message: 'No more classes left in subscription'
    })
  }

  // Add to class participants and decrement classes_left if valid
  let participant = {
    id: userId,
    username: userData.username,
  };

  let updateData = {
    $push: {
      participants: participant
    },
  }

  // Instructors don't take up a spot since they play for free
  if (userType === 'standard') {
    updateData.$inc = {
      available_spots: -1
    }
  }

  if (!course.subscription_users) {
    updateData.subscription_users = 1
  } else {
    updateData.$inc.subscription_users = 1;
  }

  let updatedClass;
  try {
    updatedClass = await Class.findOneAndUpdate({ id: course.id }, updateData, {new: true});
  } catch (err) {
    log.error("error updating class", err);
    return res.status(500).json({
      message: "Error adding participant",
      error: err.message,
    });
  }

  if (sub.classes_left > 0) {
    let subUpdate = {
      $inc: {
        classes_left: -1
      }
    }

    try {
      sub = await Subscription.findOneAndUpdate({ id: sub.id }, subUpdate, {new: true})
    } catch (err) {
      log.warn("Error updating subscription");
      return res.status(500).json({
        message: "Error updating subscription"
      })
    }
  }

  try {
    await Transaction.create({
      amount: 0,
      subscriptionId: sub.id,
      userId: userId,
      type: 'debit',
      classId: updatedClass.id,
      created_date: new Date().toISOString()
    });
  } catch (err) {
    log.warn('Add user to class - error creating credit Transaction ', err);
    return res.status(500).json({
      message: err.message
    });
  }

  let instructorData;
  try {
    instructorData = await User.findOne({id: updatedClass.instructor});
  } catch(err) {
    log.error("fetch instructor user record", err);
    return res.status(500).json({
      message: "Error fetching instructor",
      error: err.message,
    });
  }

  let combined = Object.assign({}, updatedClass._doc);
  combined.instructor = Object.assign({}, instructorData._doc);

  let message = "You're in! You'll be able to join class from this page 5 minutes before class starts."
  if (sub.classes_left > 0) {
    message += ` Classes left in subscription: ${sub.classes_left - 1}`;
  }

  res.status(200).json({
    message: message,
    course: combined,
  });
}

module.exports = {
  createSubscription,
  getProductsPrices: getUnlimitedSubProduct,
  cancelSubscription,
  getSubscription,
  getSubscriptionCostOverDays,
  addUserToClass,
  getRefundAmount,
}