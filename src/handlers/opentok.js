const OpenTok = require('opentok');
const later = require('later');
const Class = require('../db/Class');
const log = require('../log');

const APIKey = "46737292";
const opentok = new OpenTok(APIKey, "aa58ddf290d270e3284ddf9f574903d369f0d6c6");

const sessionWindow = 15;

async function createSession() {
  let settings = {
    mediaMode:"routed",
    archiveMode: "always"
  };

  return new Promise(function(response, reject) {
    opentok.createSession(settings, function(err, session) {
      if (err) return reject(err);
    
      response(session);
    });
  });
}

function getNextDate(rule, count, refDate) {
  later.date.UTC();
  let sched = later.parse.cron(rule);
  return later.schedule(sched).next(count, refDate);
}

function getPrevDate(rule, count, refDate) {
  later.date.UTC();
  let sched = later.parse.cron(rule);
  return later.schedule(sched).prev(count, refDate);
}

function makeClientToken(sessionid, role, expire, data) {
  let options = {
    role: role,
    data: data,
  };

  if (expire) {
    options.expireTime = expire;
  }

  return opentok.generateToken(sessionid, options)
}

async function joinSession(req, res) {
  
  let user = req.ctx.userData
	let filter = { id: req.params.id };
  let c;
  let sessionId;
  let token;
  let authorized = false;

	try {
		c = await Class.findOne(filter);
	} catch (err) {
		log.warn("error fetching class by id", err);
		return res.status(500).json({
      message: "Database error",
      error: err,
		});
  }
  
  if (!c) {
    return res.status(404).json({
			message: "Class not found",
		});
  }

  if (!c.start_date || (!c.start_date && !c.recurring)) {
    return res.status(400).json({
			message: "Class not scheduled",
		});
  }

  // TODO: the fact that we get different types for this is retarded. mongoose is a seriously
  // misguided mongo client that we NEED to refactor. it sucks...
	if (user._id.toString() == c.instructor.toString()) {
    log.debug("set authorized true");
		authorized = true;
  }
  
  c.participants.forEach(function(p) {
    if (p.id === user.id) {
      authorized = true;
    }
  });

  if (!authorized) {
    return res.status(403).json({
			message: "Not authorized",
		});
  }

  let now = new Date();
  let start = new Date(c.start_date);
  let end = new Date(c.start_date);
  end.setMinutes(end.getMinutes() + c.duration);
  let startWindow = new Date(start.setMinutes(start.getMinutes() - sessionWindow));
  let endWindow = new Date(end.setMinutes(end.getMinutes() + sessionWindow));

  // if it's a recurring class and the first class is in the past
  if (c.recurring && now > endWindow) {

    // get the previous event date for the recurring class in case there is an
    // active session right now
    start = getPrevDate(c.recurring, 1, now);
    end = new Date(start);
    end.setMinutes(end.getMinutes() + c.duration);
    startWindow = new Date(start.setMinutes(start.getMinutes() - sessionWindow));
    endWindow = new Date(end.setMinutes(end.getMinutes() + sessionWindow));

    // if the prev session is over then get the next session
    if (now > endWindow) {
      start = getNextDate(c.recurring, 1, now);
      end = new Date(start);
      end.setMinutes(end.getMinutes() + c.duration);
      startWindow = new Date(start.setMinutes(start.getMinutes() - sessionWindow));
      endWindow = new Date(end.setMinutes(end.getMinutes() + sessionWindow));
    }
  }

  // class session start time hasn't been reached. recurring classes are always going to 
  // fail here if it's not time for an active class session and it's not the first class
  if (now < startWindow) {
    return res.status(400).json({
      message: "Class not started yet",
    });
  }

  // class session over
  if (now > endWindow) {
    return res.status(400).json({
      message: "Class over",
    });
  }

  if (c.session) {
    sessionId = c.session[start.toISOString()]; 
  } 

	if (!sessionId) {
    try {
      session = await createSession();
    } catch(err) {
      log.error("create new opentok session id", err);
      return res.status(500).json({
        message: "Service error",
      });
    }

    log.debug("generated new opentok session id", session);

    if (!c.session) c.session = {};
    c.session[start.toISOString()] = session.sessionId;
    sessionId = session.sessionId;

    try {
      await Class.findOneAndUpdate(filter, c);
    } catch(e) {
      log.error("saving new opentok session id", e);
      return res.status(500).json({
        message: "Service error",
      });
    }
  }

  let tokenType = "publisher";

  if (user.type === "instructor" || user.type === "admin") {
    tokenType = "moderator";
  }

  let data = {
    id: user.id,
    username: user.username,
    instructor: false,
  };

  if (user._id.toString() == c.instructor.toString()) {
    data.instructor = true;
  }

  try {
    token = await makeClientToken(sessionId, tokenType, endWindow, JSON.stringify(data));
  } catch(err) {
    log.error("error generating session token", err)
    return res.status(500).json({
      message: "Service error"
    });
  }

  res.status(200).json({
    sessionId: sessionId,
    token: token,
    apiKey: APIKey,
  });
}

module.exports = {
  createSession,
  joinSession,
};