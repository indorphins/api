const StripeUser = require('../../db/StripeUser');
const Class = require('../../db/Class');
const Transaction = require('../../db/Transaction');
const Subscription = require('../../db/Subscription');
const User = require('../../db/User');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const log = require('../../log');
const utils = require('../../utils/index');
const { v4: uuidv4 } = require('uuid');
const Campaign = require('../../db/Campaign');
const { isValidCampaignForUser, updateUserCampaigns } = require('../../utils/campaign');
const APPLICATION_FEE_PERCENT = 20;

/**
 * Takes in a destination account and class id
 * Creates a stipe payment. Upon success sends data to
 * create a Transaction document in the db.
 * @param {Object} req
 * @param {Object} res
 * @param {Object} next
 */
async function create(req, res) {
  const classId = req.params.id;
  const paymentMethod = req.params.payment_method_id;
  const userData = req.ctx.userData;
  const userId = req.ctx.userData.id;
  const userType = req.ctx.userData.type;
  const campaignId = req.params.campaignId;
  let created = new Date().toISOString();
  let user, classObj, nextClassDate, paymentIntent;
  let campaign, campaignInfo;
  let price = 0;

  if (!classId || !paymentMethod) {
    return res.status(400).json({
      message: 'Missing input parameters',
    });
  }

  try {
    classObj = await Class.findOne({
      id: classId,
    });
  } catch (err) {
    log.warn('createPayment find class - error: ', err);
    return res.status(404).json({
      message: err,
    });
  }

  if (!classObj) {
    return res.status(404).json({
      message: "Class not found"
    });
  }

  nextClassDate = classObj.start_date;

  let exists = false;
  classObj.participants.forEach(function (p) {
    if (p.id == userId) {
      exists = true;
    }
  });

  if (exists) {
    return res.status(400).json({ message: "User already added to class" });
  }

  try {
    instructorAccount = await StripeUser.findOne({
      id: classObj.instructor
    });
  } catch (err) {
    return res.status(500).json({
      message: "Instuctor account not found"
    });
  }

  try {
    user = await StripeUser.findOne({
      id: userId
    });
  } catch (err) {
    log.warn('createPayment find customer stripe user - error: ', err);
    return res.status(500).json({
      message: err,
    });
  }

  if (!user.customerId) {
    const msg = "No user stripe account";
    log.warn(msg);
    return res.status(500).json({
      message: msg,
    });
  }

  // Instructors and admins don't pay for classes
  if (classObj.cost && classObj.cost > 0 && userType === 'standard') {
    price = Number(classObj.cost) * 100;

    if (campaignId) {
      try {
        campaign = await Campaign.findOne({id: campaignId});
      } catch (err) {
        log.warn("Campaign lookup", err);
      }

      if (campaign) {
        log.debug("Active campaign", campaign);
        try {
          campaignInfo = await isValidCampaignForUser(campaign, userData, price);
        } catch (err) {
          log.warn("Error determining campaign validity ", err);
        }
        
        log.debug("Campaign Info", campaignInfo);
        if (campaignInfo && (campaignInfo.price || campaignInfo.price === 0)) {
          price = campaignInfo.price;
        }
      }
    }

    if (price < 100) {
      price = 0;
    }

    const appFeeAmount = Math.round(price * (APPLICATION_FEE_PERCENT / 100));

    if (price > 0) {
      let intent = {
        payment_method_types: ['card'],
        amount: price,
        currency: 'usd',
        customer: user.customerId,
        confirm: true,
        transfer_data: {
          destination: instructorAccount.accountId,
        },
        application_fee_amount: appFeeAmount,
        payment_method: paymentMethod,
        metadata: {
          class_id: classId,
        },
      };

      try {
        paymentIntent = await stripe.paymentIntents.create(intent)
      } catch (err) {
        log.error('payment intent error', err);
        return res.status(400).json({
          message: err.message
        });
      }

      log.debug("Payment succeeded", paymentIntent.id);
    }

    // Process saving/updating campaigns to users and referrers
    await updateUserCampaigns(userData, campaign, campaignInfo);
    
    if (classObj.recurring) {
      const now = new Date();
      const nextWindow = utils.getNextSession(now, classObj);
      nextClassDate = nextWindow.date;
      let subscription;

      let nextDate = utils.getNextDate(classObj.recurring, 1, nextWindow.end)
      nextDate.setDate(nextDate.getDate() - 1);
      const timestamp = Math.round(nextDate.getTime() / 1000);

      log.debug("Subscription start date", timestamp);

      try {
        subscription = await stripe.subscriptionSchedules.create({
          customer: user.customerId,
          start_date: timestamp,
          end_behavior: 'release',
          default_settings: {
            transfer_data: {
              destination: instructorAccount.accountId,
              amount_percent: 100 - APPLICATION_FEE_PERCENT,
            }
          },
          phases: [
            {
              plans: [
                {
                  price: classObj.product_price_id,
                },
              ]
            },
          ],
          metadata: {
            class_id: classObj.id,
            prod_id: classObj.product_sku
          },
        });
      } catch(err) {
        log.error("subscription creation failed but initial class payment succeeded", err);
        //return res.status(500).json({message: err.message});
      }

      if (subscription) {
        log.debug("made stripe subscription", subscription.id, subscription.default_settings.transfer_data);
        let data = {
          id: subscription.id,
          class_id: classObj.id,
          user_id: userId,
          status: subscription.status,
          start_date: nextDate.toISOString(),
          created_date: created,
        };
    
        try {
          await Subscription.create(data);
          await Transaction.findOneAndUpdate({paymentId: paymentIntent.id}, {subscriptionId: subscription.id})
        } catch (err) {
          log.error('create subscription record fialed', err);
        }
      }
    }
  }

  let data = {
    amount: price,
    paymentId: uuidv4(),
    classId: classObj.id,
    userId: userId,
    status: 'succeeded',
    type: 'debit',
    created_date: created
  };

  if (campaignId) {
    data.campaignId = campaignId;
  }

  if (paymentIntent) {
    if (paymentIntent.id) {
      data.paymentId = paymentIntent.id;
    }
    if (paymentIntent.status) {
      data.status = paymentIntent.status;
    }
  }

  try {
    await Transaction.create(data);
  } catch (err) {
    log.warn("add transaction to db", err);
    return res.status(500).json({
      message: "Error creating transaction",
      error: err.message,
    });
  }

  let participant = {
    id: userId,
    username: req.ctx.userData.username,
  };

  let updateData = {
    $push: {
      participants: participant
    }
  }

  // Instructors don't take up a spot since they play for free
  if (userType === 'standard') {
    updateData.$inc = {
      available_spots: -1
    };
  }

  let updatedClass;
  try {
   updatedClass = await Class.findOneAndUpdate({ id: classObj.id }, updateData, {new: true});
  } catch (err) {
    log.error("error updating class", err);
    return res.status(500).json({
      message: "Error adding participant",
      error: err.message,
    });
  }

  let instructorData;
  try {
    instructorData = await User.findOne({id: classObj.instructor});
  } catch(err) {
    log.error("fetch instructor user record", err);
    return res.status(500).json({
      message: "Error fetching instructor",
      error: err.message,
    });
  }

  let combined = Object.assign({}, updatedClass._doc);
  combined.instructor = Object.assign({}, instructorData._doc);
  
  let displayedPrice = price / 100;
  if (!utils.isInteger(displayedPrice)) {
    displayedPrice = displayedPrice.toFixed(2);
  }

  let message = "You're in! You'll be able to join class from this page 5 minutes before class starts. Amount charged: " + `$${displayedPrice}.`;

  if (campaignInfo && campaignInfo.msg) {
    message += ` ${campaignInfo.msg}`;
  }
  
  res.status(200).json({
    message: message,
    course: combined,
  });
}

/**
 * Takes in a class id. Finds transaction using userId and classId
 * If transaction found and refund successful removes the user from class participant list
 * Stores refund data to req.ctx to update the transaction's status
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
async function refund(req, res) {
  const classId = req.params.id;
  const userId = req.ctx.userData.id;
  const userType = req.ctx.userData.type;
  const now = new Date();
  let course;
  let transaction;
  let message = "You have been removed from the class";

  try {
    course = await Class.findOne({
      id: classId,
    });
  } catch (err) {
    return res.status(404).json({
      message: err.message,
    });
  }

  if (!course) {
    return res.status(404).json({ message: "Class not found" });
  }

  let exists = false;
  course.participants.forEach(function(p) {
    if (p.id === userId) {
      exists = true;
    }
  });

  if (!exists) {
    return res.status(400).json({ message: "You are not in this class" });
  }

  // Find the transaction associated with user and class - if subscription go the sub route
  // otherwise go the refund route 

  let transactions;
  try {
    transactions = await Transaction.find({ 
      classId: classId,
      userId: userId,
      type: 'debit',
      amount: { $gt: 0 },
    }).sort({created_date: "desc"});
  } catch (err) {
    log.warn("Couldn't find corresponding transaction for class", err);
  }

  if (transactions && transactions[0]) {
    transaction = transactions[0];
  }

  if (!course.recurring) {

    if (now >= course.start_date) {
      return res.status(400).json({ message: "This class has already occurred and cannot be left or refunded" });
    }

    // If the class was booked without a subscription...
    if (transaction && !transaction.subscriptionId) {
      let refundWindow = new Date(course.start_date);
      refundWindow.setDate(refundWindow.getDate() - 1);
      // If beyond the refund window boot from class but don't process refund
      if (now >= refundWindow && now < course.start_date) {
        transaction.amount = 0;
        message = "This class is scheduled to start in the next 24 hours. You've been removed but no refund can be issued."
      }
    } else {
      // Find the user's subscription and add a class back to it if limited max_classes
      let subscriptions, subscription, sub;

      try {
        subscriptions = await Subscription.find({ $and: [{user_id: userId} , { $or : [{status: 'ACTIVE'}, {status: 'TRIAL'}]}]}).sort({ created_date: "desc" });
      } catch (err) {
        log.warn("Couldn't find corresponding subscriptions for user", err);
      }

      if (subscriptions && subscriptions[0]) {
        subscription = subscriptions[0];
      }


      // Add back class to classes_left if not unlimited sub (classes left > -1) and classes_left < max_classes
      if (subscription && subscription.classes_left > -1 && subscription.classes_left < subscription.max_classes) {
        try {
          sub = await Subscription.updateOne({ id: subscription.id }, { $inc: { classes_left: 1 }}, {new: true})
        } catch (err) {
          log.warn('Refund class - add class back to subscription ', err);
          return res.status(400).json({
            message: err.message,
          });
        }
      }

      if (subscription) {
        try {
          await Transaction.create({
            amount: 0,
            userId: userId,
            subscriptionId: subscription.id,
            type: 'credit',
            classId: course.id,
            created_date: new Date().toISOString()
          });
        } catch (err) {
          log.warn('Refund cancel - error creating credit Transaction ', err);
          return res.status(500).json({
            message: err.message
          });
        }
      }
    }
  } else {

    let refundWindow = new Date(course.start_date);
    refundWindow.setDate(refundWindow.getDate() - 1);

    if (now >= refundWindow && now < course.start_date) {
      return res.status(400).json({ 
        message: "This class is scheduled to start in the next 24 hours and cannot be left or refunded until the upcoming class session has finished"
      });
    }

    let nextSession = utils.getNextSession(now, course);
    log.debug("next class session data for recurring class", nextSession)

    if (now >= nextSession.start && now <= nextSession.end) {
      return res.status(400).json({ 
        message: "This class is active and cannot be left or refunded until the current class session has finished"
      });
    }

    refundWindow = new Date(nextSession.date);
    refundWindow.setDate(refundWindow.getDate() - 1);
    if (now >= refundWindow && now < course.start_date) {
      return res.status(400).json({ 
        message: "This class is scheduled to start in the next 24 hours and cannot be left or refunded until the upcoming class session has finished" 
      });
    }

    let courseSubs;
    let sub;
    try {
      courseSubs = await Subscription.find({class_id: course.id, user_id: userId}).sort({created_date: "desc"});
    } catch(err) {
      log.warn("finding class subscription record", err);
      return res.status(500).json({ message: err.message });
    }

    if (courseSubs && courseSubs[0]) {
      sub = courseSubs[0];
    }

    if (sub) {
      let result;
      try {
        result = await stripe.subscriptionSchedules.cancel(sub.id);
      } catch(err) {
        log.error("cancel stripe subscription schedule", err);
        return res.status(500).json({ message: err.message });
      }

      try {
        await Subscription.findOneAndUpdate({id: sub.id}, {status: result.status});
      } catch (err) {
        log.error("updated subscription record", err);
        return res.status(500).json({ message: err.message });
      }

      let transactions;
      try {
        transactions = await Transaction.find({ 
          classId: classId,
          userId: userId,
          subscriptionId: sub.id, 
          type: 'debit',
          amount: { $gt: 0 }
        }).sort({created_date: "desc"});
      } catch (err) {
        log.warn("Couldn't find corresponding transaction for class", err);
      }

      log.debug("transactions", transactions);

      if (transactions && transactions[0] && transactions.length === 1) {
        if (transactions[0].created_date < course.start_date) {
          transaction = transactions[0];
        }

        let firstSession = utils.getPrevDate(course.recurring, 1, sub.start_date);
        if (now < firstSession) {
          transaction = transactions[0];
        }
      }
    }
  }

  // There should be a transaction but with 0 amount if from subscription
  if (transaction && transaction.amount > 0) {
    let refundTransaction;
    try {
      refundTransaction = await stripe.refunds.create({
        payment_intent: transaction.paymentId,
        reverse_transfer: true,
        refund_application_fee: true, // Gives back the platform fee
      });
    } catch (err) {
      log.warn('Stripe - refundCharge create refund error: ', err);
      let re = /is already fully reversed/g
      if (!err.message.match(re)) {
        return res.status(400).json({
          message: err.message,
        });
      }
    }

    if (refundTransaction) {
      try {
        await Transaction.create({
          amount: transaction.amount,
          subscriptionId: subscription.id,
          classId: classId,
          userId: userId,
          type: 'credit',
          created_date: new Date().toISOString()
        });
      } catch (err) {
        return res.status(500).json({
          message: err.message
        });
      }
      message = message + ", and your recent payment refunded";
    }
  }

  let updateData = {
    $pull: {
      participants: {
        id: userId
      }
    }
  }

  if (userType === 'standard') {
    updateData.$inc = {
      available_spots: 1
    }

    if (transaction && transaction.subscriptionId) {
      updateData.$inc.subscription_users = -1;
    }
  }

  let updatedCourse;
  try {
    updatedCourse = await Class.findOneAndUpdate({id: course.id}, updateData, {new: true});
  } catch(err) {
    return res.status(500).json({
      message: err.message
    });
  }

  let instructorData;
  try {
    instructorData = await User.findOne({id: course.instructor});
  } catch(err) {
    log.error("fetch instructor user record", err);
    return res.status(500).json({
      message: "Error fetching instructor",
      error: err.message,
    });
  }

  let data = Object.assign({}, updatedCourse._doc);
  data.instructor = Object.assign({}, instructorData._doc);

  return res.status(200).json({
    message: message + ". Sorry to see you go 👋",
    course: data,
  });
}

module.exports = {
  create,
  refund
};