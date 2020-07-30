const uuid = require('uuid');
const Class = require('../db/Class');
const User = require('../db/User');
const log = require('../log');
const utils = require('../utils');
const message = require('./message');
const Transaction = require('../db/Transaction');
const Subscription = require('../db/Subscription');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Utility function to decode a custom filter or sort order passed in through query parameters.
 * @param {String} value - base64 encoded and stringified json object representing a valid mongo filter or sort object
 */
function decodeQueryParam(value) {
  let buff = new Buffer.from(value, 'base64');
  let data = null;

  try {
    data = buff.toString('utf-8');
    data = JSON.parse(data);
  } catch (err) {
    log.warn("invalid encoded object", err);
    return null;
  }

  return data;
}

/**
 * Express handler for getting existing classes. Supports a number of different query params for
 * filtering and sorting or different fields and parameters.
 * TODO: should guard against searches that will go against non indexed fields
 * @param {Object} req - http request object
 * @param {Object} res - http response object
 */
async function getClasses(req, res) {

  let page = req.query.page ? Number(req.query.page) - 1 : 0;
  let limit = req.query.limit ? Number(req.query.limit) : 50;
  let order = /*{ start_date: "desc", name: "asc" };*/ {};
  let filter = /*{ start_date: { $gte : new Date().toISOString() }, available_spots: { $gt: 0 }}*/ {};

  if (req.query.filter) {
    let data = decodeQueryParam(req.query.filter);

    if (data) {
      filter = data;
    }
  }

  if (req.query.order) {
    let data = decodeQueryParam(req.query.order);

    if (data) {
      order = data;
    }
  }

  let total;
  let results;

  try {
    total = await Class.find(filter).countDocuments();
    results = await Class.find(filter).sort(order).skip(page * limit).limit(limit);
  } catch (err) {
    res.status(500).json({
      message: err,
    });
  }

  res.status(200).json({
    total: total,
    page: page + 1,
    limit: limit,
    data: results,
  });
};

/**
 * Express handler to create a new class record. Action should only be allowed by
 * Admins and Instructors, not regular users.
 * @param {Object} req - http request object
 * @param {Object} res - http response object
 */
async function createClass(req, res) {

  let classData = req.body;
  let newClass = null;
  let productSkuData = null;

  classData.id = uuid.v1();
  classData.created_date = new Date().toISOString();
  classData.available_spots = classData.total_spots;
  classData.instructor = req.ctx.userData.id;
  classData.participants = [];

  try {
    productSkuData = await utils.createClassSku(classData);
  } catch (err) {
    log.warn('Error creating class sku: ', err);
    return res.status(400).json({
      message: "issue creating class sku",
      error: err
    });
  }

  classData.product_sku = productSkuData.product_sku;
  classData.product_price_id = productSkuData.product_price_id;

  try {
    newClass = await Class.create(classData);
  } catch (err) {
    log.warn('Error creating class: ', err);
    return res.status(400).json({
      message: "issue creating class",
      error: err
    });
  }

  log.debug('New class created', newClass);
  res.status(201).json({
    message: "New class added",
    data: newClass,
  });
};

/**
 * Express handler to get a class record.
 * @param {Object} req - http request object
 * @param {Object} res - http response object
 */
async function getClass(req, res) {

  let filter = { id: req.params.id };
  let c = null;
  let i = null;

  try {
    c = await Class.findOne(filter);
  } catch (err) {
    log.warn("error fetching class by id", err);
    return res.status(404).json({
      message: "Class not found",
    });
  }

  try {
    i = await User.findOne({ id: c.instructor })
  } catch (err) {
    log.warn("error fetching instructor", err);
    return res.status(404).json({
      message: "Class not found",
    });
  }

  let data = Object.assign({}, c._doc);
  data.instructor = Object.assign({}, i._doc);

  log.debug("course data", data);

  res.status(200).json(data);
};

/**
 * Express handler to update a class record. Only allowed by Admins and Instuctors.
 * @param {Object} req - http request object
 * @param {Object} res - http response object
 */
async function updateClass(req, res) {

  let c = null;
  let data = req.body;
  let id = req.params.id ? req.params.id : req.ctx.classId;

  if (data.participants) {
    delete data.participants;
  }

  try {
    c = await Class.findOneAndUpdate(
      { id: id, instructor: req.ctx.userData },
      { $set: data }
    );
  } catch (err) {
    log.warn("error updating class", err);
    return res.status(400).json({
      message: "Error updating class",
      error: err,
    });
  }

  res.status(200).json({
    message: "Class updated"
  });
};

/**
 * Express handler to delete a class. Only allowed by Admins and Instructors.
 * Refunds the user if they've made a payment and if that payment is elligble for refund.
 * @param {Object} req - http request object
 * @param {Object} res - http response object
 */
async function deleteClass(req, res) {

  let filter = { id: req.params.id };
  let c = null;

  try {
    c = await Class.findOne(filter);
  } catch (err) {
    log.error("Database error", err);
    return res.status(500).json({
      message: "Database error",
      error: err
    });
  }

  if (!c) {
    return res.status(404).json({
      message: "Class not found",
    });
  }

  let transactions, transaction, refundTransaction;

  if (!c.recurring) {
    await asyncForEach(c.participants, async p => {
      try {
        transactions = await Transaction.find({ classId: c.id, userId: p.id, type: 'debit' }).sort({ created_date: "desc" });
      } catch (err) {
        log.warn("Couldn't find corresponding transactions for class", err);
      }
      
      if (transactions && transactions[0]) {
        transaction = transactions[0];
      }

      if (transaction) {
        try {
          refundTransaction = await stripe.refunds.create({
            payment_intent: transaction.paymentId,
            reverse_transfer: true,
            refund_application_fee: true, // Gives back the platform fee
          });
        } catch (err) {
          log.warn('Class cancel - refundCharge create refund error: ', err);
          return res.status(400).json({
            message: err.message,
          });
        }

        try {
          await Transaction.create({
            amount: transaction.amount,
            paymentId: refundTransaction.id,
            classId: c.id,
            userId: p.id,
            status: refundTransaction.status,
            type: 'credit',
            created_date: new Date().toISOString()
          });
        } catch (err) {
          log.warn('Class cancel - error creating credit Transaction ', err);
          return res.status(500).json({
            message: err.message
          });
        }
      }
    });
  } else {

    await asyncForEach(c.participants, async p => {
      const now = new Date();
      let nextSession = utils.getNextSession(now, c);
      let refundWindow = new Date(nextSession.date);
      refundWindow.setDate(refundWindow.getDate() - 1);

      let courseSubs;
      let sub;
      try {
        courseSubs = await Subscription.find({ class_id: c.id, user_id: p.id }).sort({ created_date: "desc" });
      } catch (err) {
        log.warn("Class Cancel - error finding class subscription record", err);
        return res.status(500).json({ message: err.message });
      }

      if (courseSubs && courseSubs[0]) {
        sub = courseSubs[0];
      }

      if (sub && sub.status !== 'canceled') {
        let result;
        try {
          result = await stripe.subscriptionSchedules.cancel(sub.id);
        } catch (err) {
          log.error("Class Cancel cancel stripe subscription schedule", err);
          return res.status(500).json({ message: err.message });
        }

        try {
          await Subscription.findOneAndUpdate({ id: sub.id }, { status: result.status });
        } catch (err) {
          log.error("updated subscription record", err);
          return res.status(500).json({ message: err.message });
        }

        try {
          transactions = await Transaction.find({
            classId: c.id,
            userId: p.id,
            subscriptionId: sub.id,
            type: 'debit',
          }).sort({ created_date: "desc" });
        } catch (err) {
          log.warn("Couldn't find corresponding transactions for class", err);
        }

        // Refund them if they've paid in the last 24 hours before this class starts or if they paid the initial payment and the class hasn't taken place
        let prev = utils.getPrevDate(c.recurring, 1, now);
        prev.setMinutes(prev.getMinutes() + c.duration);

        if (transactions && transactions[0] && (transactions[0].created_date >= refundWindow || (transactions[0].created_date < nextSession.end && transactions[0].created_date > prev && transactions.length === 1))) {
          transaction = transactions[0];
        }

        if (transaction) {
          try {
            refundTransaction = await stripe.refunds.create({
              payment_intent: transaction.paymentId,
              reverse_transfer: true,
              refund_application_fee: true, // Gives back the platform fee
            });
          } catch (err) {
            log.warn('Class cancel - refundCharge create refund error: ', err);
            return res.status(400).json({
              message: err.message,
            });
          }

          try {
            await Transaction.create({
              amount: transaction.amount,
              paymentId: refundTransaction.id,
              classId: c.id,
              userId: p.id,
              status: refundTransaction.status,
              type: 'credit',
              created_date: new Date().toISOString()
            });
          } catch (err) {
            return res.status(500).json({
              message: err.message
            });
          }
        }
      }
    });
  }

  try {
    let r = await Class.deleteOne(filter);
  } catch (err) {
    log.warn("error removing class", err);
    return res.status(500).json({
      message: "Error removing class - refunds have gone through",
      error: err,
    });
  }

  res.status(200).json({
    message: "Class removed",
  });
};

async function addParticipant(req, res) {

  let c = null;

  try {
    c = await Class.findOne({ id: req.params.id });
  } catch (err) {
    log.warn("database error", err);
    return res.status(500).json({
      message: "Database error",
      error: err,
    });
  }

  if (!c) {
    return res.status(404).json({ message: "Class does not exist" });
  }

  let data = {
    id: req.ctx.userData.id,
    username: req.ctx.userData.username,
    email: req.ctx.userData.email
  };

  if (req.params.user_id) {
    data.id = req.params.user_id
  }

  let exists = false;
  c.participants.forEach(function (p) {
    if (p.id == data.id) {
      exists = true;
    }
  });

  if (exists) {
    return res.status(400).json({ message: "User already added to class" });
  }

  c.participants.push(data);
  c.available_spots = c.available_spots - 1;

  try {
    await Class.updateOne({ id: req.params.id }, c);
  } catch (err) {
    log.warn("error updating class", err);
    return res.status(400).json({
      message: "Error adding participant",
      error: err,
    });
  }

  res.status(200).json({
    message: "User added to class"
  });
}

async function removeParticipant(req, res) {
  let c = null;

  try {
    c = await Class.findOne({ id: req.params.id });
  } catch (err) {
    log.warn("database error", err);
    return res.status(500).json({
      message: "Database error",
      error: err,
    });
  }

  if (!c) {
    return res.status(404).json({ message: "Class does not exist" });
  }

  let data = {
    id: req.ctx.userData.id,
    username: req.ctx.userData.username
  };

  if (req.params.user_id) {
    data.id = req.params.user_id
  }

  let index = -1;
  for (var i = 0; i < c.participants.length; i++) {
    if (c.participants[i].id == data.id) {
      index = i;
    }
  }

  if (index == -1) {
    return res.status(400).json({ message: "User not in class" });
  }

  c.participants.splice(index, 1);
  c.available_spots = c.available_spots + 1;

  try {
    await Class.updateOne({ id: req.params.id }, c);
  } catch (err) {
    log.warn("error updating class", err);
    return res.status(400).json({
      message: "Error adding participant",
      error: err,
    });
  }

  res.status(200).json({
    message: "User removed from class"
  });

}

async function emailClass(req, res) {
  const userData = req.ctx.userData;
  const html = req.body.html;
  let c;

  if (userData.type !== 'instructor' && userData.type !== 'admin') {
    log.warn("Only instructors can send class messages")
    return res.status(400).json({
      message: "Only instructors can send class messages"
    })
  }

  if (!html) {
    log.warn("Invalid html message");
    return res.status(400).json({
      message: 'Invalid html message'
    })
  }

  try {
    c = await Class.findOne({ id: req.params.id });
  } catch (err) {
    log.warn("database error", err);
    return res.status(500).json({
      message: "Database error",
      error: err,
    });
  }

  if (!c) {
    log.warn("No class found to message");
    return res.status(404).json({
      message: "Class not found",
    })
  }

  if (c.participants.length == 0) {
    log.info("No users in class can't send email");
    return res.status(400).json({
      message: "no_users_in_class"
    })
  }

  let participants = c.participants.map(participant => {
    return participant.id;
  });


  let users;

  try {
    users = await User.find({ id: { $in: participants } })
  } catch (err) {
    log.warn("database error", err);
    return res.status(500).json({
      message: "Database error",
      error: err,
    });
  }

  participants = users.map(user => {
    return user.email
  });

  const subject = utils.createClassEmailSubject(c.start_date, userData.first_name);
  const defaultMessage = utils.createDefaultMessageText(c.start_date, userData.first_name);

  try {
    await message.sendEmail(participants, utils.getEmailSender(), subject, defaultMessage, html, true);
  } catch (err) {
    log.warn("Error sending class email: ", err);
    return res.status(400).json({
      message: 'Error sending class email',
      error: err
    })
  }

  res.status(200).json({
    message: "Sent class email success"
  })
}


async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

module.exports = {
  deleteClass,
  updateClass,
  getClass,
  getClasses,
  createClass,
  addParticipant,
  removeParticipant,
  emailClass
};
