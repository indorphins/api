const Session = require('../db/Session');
const Class = require('../db/Class');
const log = require('../log');

async function updateSession(req, res) {
  const userData = req.ctx.userData;
  const sessionId = req.params.sessionId;
  const classId = req.params.classId;

  let sessionData;
  let course;

  try {
    sessionData = await Session.findOneAndUpdate(
      { class_id: classId, session_id: sessionId }, 
      {
        $addToSet: {
          users_joined: userData.id
        }
      },
      { new: true })
  } catch (err) {
    log.warn("Error updating session ", err);
    res.status(500).json({
      message: 'Error updating session'
    });
  }

  if (!sessionData) {
    try {
      course = await Class.findOne({id: classId});
    } catch (err) {
      log.warn("Error updating session ", err);
      res.status(500).json({
        message: 'Error updating session'
      });
    }

    const newSession = {
      instructor_id: course.instructor,
      class_id: classId,
      session_id: sessionId,
      users_enrolled: course.participants.map(item => {
        return item.id;
      }),
      users_joined: [userData.id],
      start_date: course.start_date,
      type: course.type,
    }

    try {
      sessionData = await Session.create(newSession);
    } catch (err) {
      log.warn("Error creating new session ", err);
      res.status(500).json({
        message: 'Database error'
      })
    }
  }

  res.status(200).json(sessionData);
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
    start_date: startDate,
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
    sessions = await Session.find({ users_joined: userData.id }).sort({ start_date: -1 }).limit(1000)
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

async function getInstructorSessions(req, res) {
  const instructorId = req.params.instructorId;

  let sessions = [];

  try {
    sessions = await Session.find({ instructor_id: instructorId });
  } catch (err) {
    log.warn("Error finding sessions");
    res.status(500).json({
      message: 'Error finding sessions'
    });
  }

  if (sessions && sessions.length > 0) {
    let classIds = sessions.map(session => {
      return session.class_id;
    });

    let classes;
    try {
      classes = await Class.find({ id: { $in: classIds }})
    } catch (err) {
      log.warn("Error finding classes");
      res.status(500).json({
        message: 'Error finding classes'
      });
    }

    let data = sessions.map(session => {
      return {
        session_id: session.session_id,
        instructor_id: session.instructor_id,
        class_id: session.class_id,
        start_date: session.start_date
      }
    })

    if (classes && classes.length > 0) {
      data = data.map(session => {
        let course = classes.find(c => c.id === session.class_id )
        if (course) session.classTitle = course.title;
        return session;
      })
    }

    sessions = data;
  }
  return res.status(200).json(sessions);
}

module.exports = {
  createSession,
  updateSession,
  deleteSession,
  getSession,
  getAllSessions,
  getInstructorSessions
};