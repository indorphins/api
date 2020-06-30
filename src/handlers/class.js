const uuid = require('uuid');
const Class = require('../db/Class');
const User = require('../db/User');
const log = require('../log');

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

  classData.id = uuid.v1();
  classData.created_date = new Date().toISOString();
  classData.available_spots = classData.total_spots;
  classData.instructor = req.ctx.userData;
  classData.participants = [];

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
    i = await User.findOne({ _id: c.instructor })
  } catch (err) {
    log.warn("error fetching instructor", err);
    return res.status(404).json({
      message: "Class not found",
    });
  }

  c.instructor = i;

  console.log("Got Class: ", c);

  res.status(200).json(c);
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

  console.log("Instructor is ", req.ctx.userData);
  console.log('class id is ', req.params.id);
  console.log("Update data is ", data)
  console.log("Context class is ", req.ctx.classId);


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

  console.log("Updated class ", c);

  res.status(200).json({
    message: "Class updated"
  });
};

/**
 * Express handler to delete a class. Only allowed by Admins and Instructors.
 * @param {Object} req - http request object
 * @param {Object} res - http response object
 */
async function deleteClass(req, res) {

  let filter = { id: req.params.id, instructor: req.ctx.userData };
  let c = null;

  // Check for class
  try {
    c = await Class.findOne(filter);
  } catch (err) {
    log.error("Database error", err);
    return res.status(500).json({
      message: "Database error",
      error: err
    });
  }

  // Make sure class isn't null
  if (!c) {
    return res.status(404).json({
      message: "Class not found",
    });
  }

  // Check if class has signed up participants
  // TODO: work out a scheme for refunds.
  if (c.participants.length > 0) {
    return res.status(400).json({
      message: "Cannot remove class, it has participants.",
    });
  }

  // Try to delete the db document
  try {
    let r = await Class.deleteOne(filter);
  } catch (err) {
    log.warn("error removing class", err);
    return res.status(500).json({
      message: "Error removing class",
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
    username: req.ctx.userData.username
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

module.exports = {
  deleteClass,
  updateClass,
  getClass,
  getClasses,
  createClass,
  addParticipant,
  removeParticipant,
};
