const Reportings = require('../db/Reportings');
const InstructorReportings = require('../db/InstructorReportings');
const User = require('../db/User');
const Class = require('../db/Class');
const log = require('../log');
const utils = require('../utils/index');

async function getReports(req, res) {
  const userData = req.ctx.userData;

  if (userData.type === 'standard') {
    return res.status(403).json({
      message: "Account type forbidden"
    })
  }

  let reports;

  try {
    reports = await Reportings.find().sort({week: -1, year: -1});
  } catch (err) {
    log.warn("Error finding reports");
    return res.status(500).json({
      message: 'Error finding reports'
    });
  }

  res.status(200).json(reports);
}

async function getInstructorReports(req, res) {
  const userData = req.ctx.userData;

  if (userData.type === 'standard') {
    return res.status(403).json({
      message: "Account type forbidden"
    })
  }

  let reports;

  try {
    reports = await InstructorReportings.find().sort({week: -1, year: -1});
  } catch (err) {
    log.warn("Error finding reports");
    return res.status(500).json({
      message: 'Error finding reports'
    });
  }

  res.status(200).json(reports);
}

async function getReportsByDomain(req, res) {
  const userData = req.ctx.userData;
  const domain = req.params.domain;

  if (userData.type !== 'admin') {
    return res.status(403).json({
      message: "Account type forbidden"
    })
  }

  const domainRegex = `@${domain}`
  let users;

  try {
    users = await User.find({email: {$regex: domainRegex, $options: 'i'}});
  } catch (err) {
    log.warn("Error finding users by domain ", err);
    return res.status(500).json({
      message: "Error fetching data by domain"
    })
  }
  let userIDs = users.map(u => {
    return u.id;
  })

  let classes = [];

  await utils.asyncForEach(users, async user => {
    let userClassMap = {}
    let userClasses = [];
    try {
      userClasses = await Class.find({"participants.id": user.id});
    } catch (err) {
      log.warn("Get reports by domain DB error finding classes by id ", id, err);
      return res.status(500).json({
        message: 'Database error'
      })
    }
    userClassMap[user.email] = userClasses
    classes.push(userClassMap)
  })

  return res.status(200).json(classes)
}

async function getReportsByUser(req, res) {
  const userData = req.ctx.userData;
  const userEmail = req.params.user_email;

  if (userData.type !== 'admin') {
    return res.status(403).json({
      message: "Account type forbidden"
    })
  }

  let user;

  try {
    user = await User.findOne({email: userEmail});
  } catch (err) {
    log.warn("Error finding user classes ", err);
    return res.status(500).json({
      message: "Error finding user classes"
    })
  }

  if (!user || !user.id) {
    log.warn("getReportsByUser - No user exists with that email");
    return res.status(500).json({
      message: "No user exists with that email"
    })
  }

  let classes;

  try {
    classes = await Class.find({ "participants.id" : user.id });
  } catch (err) {
    log.warn("Error finding classes for user ", err);
    return res.status(500).json({
      message: "Error finding user classes"
    })
  }

  let userClassPair = {}
  userClassPair[user.email] = classes
  return res.status(200).json([userClassPair]);
}

module.exports = {
  getReports,
  getInstructorReports,
  getReportsByDomain,
  getReportsByUser
}