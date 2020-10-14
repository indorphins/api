const Reportings = require('../db/Reportings');

async function getReports(req, res) {
  const userData = req.ctx.userData;

  if (userData.type === 'standard') {
    res.status(403).json({
      message: "Account type forbidden"
    })
  }

  let reports;

  try {
    reports = await Reportings.find().sort({week: -1, year: -1});
  } catch (err) {
    log.warn("Error finding reports");
    res.status(500).json({
      message: 'Error finding reports'
    });
  }

  res.status(200).json(reports);
}

module.exports = {
  getReports
}