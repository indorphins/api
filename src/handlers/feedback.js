const ClassFeedback = require('../db/ClassFeedback');
const log = require('../log');

async function post(req, res) {
  const userId = req.ctx.userData.id;
  const id = req.params.id;
  const sessionId = req.params.sessionId;
  const body = req.body;

  if (!body) {
    return res.status(400).json({
      message: "Missing request body"
    });
  }

  const base = {
    classId: id,
    userId: userId,
    sessionId: sessionId,
    created_date: new Date(),
  }

  const data = Object.assign(base, body);

  log.debug("setting class feedback", data);

  try {
    await ClassFeedback.create(data);
  } catch (err) {
    log.error("Database error", err);
    return res.status(500).json({
      message: "Database error",
      error: err
    });
  }

  return res.status(200).json({
    message: "Great success!"
  })
}

module.exports = {
  post: post
}