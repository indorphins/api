const Reportings = require('../db/Reportings');
const InstructorReportings = require('../db/InstructorReportings');
const User = require('../db/User');
const Class = require('../db/Class');
const {} = require('date-fns')

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

  if (userData.type === 'standard') {
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

  console.log("DOMAIN  ", domain);
  let classes;

  try {
    classes = await Class.find({ "participants.id" : {$in: userIDs} });
  } catch (err) {
    log.warn("Error finding classes for users by domain ", err);
    return res.status(500).json({
      message: "Error fetching data by domain"
    })
  }

  console.log("GOT DOMAIN CLASSES ", classes);
  console.log("GOT DOMAIN USERS ", users);

  return res.status(200).json({
    classes: classes,
    users: users
  })
}

module.exports = {
  getReports,
  getInstructorReports,
  getReportsByDomain
}