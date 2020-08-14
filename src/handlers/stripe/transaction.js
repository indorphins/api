
const StripeUser = require('../../db/StripeUser');
const Class = require('../../db/Class');
const Transaction = require('../../db/Transaction');
const Subscription = require('../../db/Subscription');
const User = require('../../db/User');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const log = require('../../log');
const utils = require('../../utils/index');
const Milestone = require('../../db/Milestone');
const milestoneUtils = require('../../utils/milestone');

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
  const userId = req.ctx.userData.id;
  let created = new Date().toISOString();
  let user, classObj, price;
  let nextClassDate;

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

  if (classObj.cost && classObj.cost > 0) {
    price = Number(classObj.cost) * 100;
    let intent = {
      payment_method_types: ['card'],
      amount: price,
      currency: 'usd',
      customer: user.customerId,
      confirm: true,
      transfer_data: {
        destination: instructorAccount.accountId,
      },
      application_fee_amount: price * (APPLICATION_FEE_PERCENT / 100),
      payment_method: paymentMethod,
      metadata: {
        class_id: classId,
      },
    };

    let paymentIntent;
    try {
    paymentIntent = await stripe.paymentIntents.create(intent)
    } catch (err) {
      log.error('payment intent error', err);
      return res.status(400).json({
        message: err.message
      });
    }

    log.debug("Payment succeeded", paymentIntent.id);

    let data = {
      amount: price,
      paymentId: paymentIntent.id,
      classId: classObj.id,
      userId: userId,
      status: paymentIntent.status,
      type: 'debit',
      created_date: created
    };

    try {
      await Transaction.create(data);
    } catch (err) {
      log.warn("add transaction to db", err);
      return res.status(500).json({
        message: "Error creating transaction",
        error: err.message,
      });
    }
    
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

  let participant = {
    id: userId,
    username: req.ctx.userData.username,
  };

  classObj.participants.push(participant);
  classObj.available_spots = classObj.available_spots - 1;

  let updatedClass;
  try {
   updatedClass = await Class.findOneAndUpdate({ id: classObj.id }, classObj, {new: true});
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

  // Create user milestone if it doesn't already exist
  let milestone;

  try {
    milestone = await Milestone.findOne({ user_id: userId })
  } catch (err) {
    log.warn('Error finding milestone: ', err);
    return res.status(400).json({
      message: "database error",
    });
  }

  if (!milestone) {
    milestone = milestoneUtils.getNewMilestone(userId);

    try {
      milestone = await Milestone.create(milestone);
    } catch (err) {
      log.warn("Error creating instructor milestone on course creation ", err);
      return res.status(400).json({
        message: "Error creating instructor milestone"
      })
    }
  }

  let combined = Object.assign({}, updatedClass._doc);
  combined.instructor = Object.assign({}, instructorData._doc);
  let message = "You're in! You'll be able to join class from this page 5 minutes before class starts";
  
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

  if (!course.recurring) {

    if (now >= course.start_date) {
      return res.status(400).json({ message: "This class has already occurred and cannot be left or refunded" });
    }

    let refundWindow = new Date(course.start_date);
    refundWindow.setDate(refundWindow.getDate() - 1);
    if (now >= refundWindow && now < course.start_date) {
      return res.status(400).json({ message: "This class is scheduled to start in the next 24 hours and cannot be left or refunded" });
    }

    let transactions;
    try {
      transactions = await Transaction.find({ classId: classId, userId: userId, type: 'debit' }).sort({created_date: "desc"});
    } catch (err) {
      log.warn("Couldn't find corresponding transaction for class", err);
    }

    if (transactions && transactions[0]) {
      transaction = transactions[0];
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
        }).sort({created_date: "desc"});
      } catch (err) {
        log.warn("Couldn't find corresponding transaction for class", err);
      }

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

  if (transaction) {
    let refundTransaction;
    try {
      refundTransaction = await stripe.refunds.create({
        payment_intent: transaction.paymentId,
        reverse_transfer: true,
        refund_application_fee: true, // Gives back the platform fee
      });
    } catch (err) {
      log.warn('Stripe - refundCharge create refund error: ', err);
      return res.status(400).json({
        message: err.message,
      });
    }

    try {
      await Transaction.create({
        amount: transaction.amount,
        paymentId: refundTransaction.id,
        classId: classId,
        userId: userId,
        status: refundTransaction.status,
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

  course.participants = course.participants.filter(item => { return item.id !== userId; });
  course.available_spots = course.available_spots + 1;

  let updatedCourse;
  try {
    updatedCourse = await Class.findOneAndUpdate({id: course.id}, course, {new: true});
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