const Session = require('../db/Session');
const log = require('../log');

async function updateSession(req, res) {
  const userData = req.ctx.userData;
  const sessionId = req.params.sessionId;
  const classId = req.params.classId;
  const data = req.body;

  let session;

  try {
    session = await Session.findOneAndUpdate( { class_id: classId, session_id: sessionId }, { $set: data });
  } catch (err) {
    log.warn("Error finding session");
    res.status(500).json({
      message: 'Error finding session'
    });
  }

  res.status(200).json(session);
}

async function getSession(req, res) {
  const sessionId = req.params.sessionId;
  const classId = req.params.classId;

  let session;

  try {
    session = await Session.findOne({ class_id: classId, session_id: sessionId });
  } catch (err) {
    log.warn("Error finding session");
    res.status(500).json({
      message: 'Error finding session'
    });
  }

  res.status(200).json(session);
}

async function deleteSession(req, res) {
  const sessionId = req.params.sessionId;
  const classId = req.params.classId;

  let session;

  try {
    session = await Session.deleteOne({ class_id: classId, session_id: sessionId });
  } catch (err) {
    log.warn("error removing class", err);
    return res.status(500).json({
      message: "Error deleting session record",
      error: err,
    });
  }

  res.status(200).json({
    message: "Session removed",
  });
}

async function createSession(req, res) {
  const sessionId = req.params.sessionId;
  const classId = req.params.classId;
  const instructor = req.body.instructor;
  const startDate = req.body.start_date;

  let session;

  const newSession = {
    instructor_id: instructor,
    class_id: classId,
    session_id: sessionId,
    users_enrolled: [],
    users_joined: [],
    start_date: startDate
  }

  try {
    session = await Session.create(newSession);
  } catch (err) {
    log.warn("Error creating new session ", err);
    res.status(500).json({
      message: 'Database error'
    })
  }

  res.status(200).json(session);
}

async function getAllSessions(req, res) {
  const userData = req.ctx.userData;

  let sessions;

  try {
    sessions = await Session.find({ users_joined: userData.id }).sort({ start_date: -1 })
  } catch (err) {
    log.warn("Error fetching user's sessions");
    res.status(500).json({
      message: 'Error fetching user sessions'
    })
  }

  res.status(200).json({
    sessions: sessions
  });
}

module.exports = {
  createSession,
  updateSession,
  deleteSession,
  getSession,
  getAllSessions
};