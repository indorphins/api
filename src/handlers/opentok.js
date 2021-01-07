const OpenTok = require('opentok');
const Class = require('../db/Class');
const Session = require('../db/Session');
const log = require('../log');
const utils = require('../utils/index');
const jwt = require('jwt-simple');
const uuid = require('uuid');
const request = require('request');

const projectAPIKey = "46817934";
const projectAPISecret = "6e0d8092fd0c009620481f1614e56c696e9a1049";
const opentok = new OpenTok(projectAPIKey, projectAPISecret);
const archiveAPIKey = "46817934";

async function createSession(archive, media) {
  let settings = {
    archiveMode: archive,
    mediaMode: media,
  };

  return new Promise(function(response, reject) {
    opentok.createSession(settings, function(err, session) {
      if (err) return reject(err);
      
      response(session);
    });
  });
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
	if (user.id == c.instructor) {
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
  let sessionWindow = 10;
  const nextSession = utils.getNextSession(now, c, sessionWindow);

  // class session start time hasn't been reached. recurring classes are always going to 
  // fail here if it's not time for an active class session and it's not the first class
  if (now < nextSession.start) {
    return res.status(400).json({
      message: "Class not started yet",
    });
  }

  // class session over
  if (now > nextSession.end) {
    return res.status(400).json({
      message: "Class over",
    });
  }

  if (c.session) {
    sessionId = c.session[nextSession.date.toISOString()]; 
  } 

	if (!sessionId) {
    if (user.id !== c.instructor) {
      return res.status(400).json({
        message: "The instructor has not started this class yet. Please try again in a minute.",
      });
    }

    try {
      session = await createSession("manual", "routed");
    } catch(err) {
      log.error("create new opentok session id", err);
      return res.status(500).json({
        message: "Service error",
      });
    }

    const newSession = {
      instructor_id: c.instructor,
      class_id: c.id,
      session_id: session.sessionId,
      users_joined: [],
      start_date: c.start_date,
      type: c.type
    }
    
    try {
      await Session.create(newSession);
    } catch (err) {
      log.warn("Database error creating session");
      res.status(500).json({
        message: "Database error"
      })
    }

    log.debug("generated new opentok session id", session);

    if (!c.session) c.session = {};
    c.session[nextSession.date.toISOString()] = session.sessionId;
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
    id: uuid.v4(),
    username: user.username,
    instructor: false,
  };

  if (user.id == c.instructor) {
    data.instructor = true;
    data.id = user.id;
  }

  try {
    token = await makeClientToken(sessionId, tokenType, nextSession.end, JSON.stringify(data));
  } catch(err) {
    log.error("error generating session token", err)
    return res.status(500).json({
      message: "Service error"
    });
  }

  return res.status(200).json({
    sessionId: sessionId,
    token: token,
    apiKey: projectAPIKey,
  });
}

async function fetchArchives(req, res) {
  const sessionId = req.body.sessionId;
  let url = `https://api.opentok.com/v2/project/${projectAPIKey}/archive`;

  if (sessionId) {
    url += `?sessionId=${sessionId}`;
  } else {
    log.warn("Session ID required to fetch archive");
    return res.status(400).json({
      message: 'Session ID required'
    })
  }

  const threeMinutesInSeconds = 180 * 60;
  let options = {
    "iss": projectAPIKey,
    "iat": Math.round(Date.now() / 1000), 
    "exp": Math.round(Date.now() / 1000) + threeMinutesInSeconds,
    "ist": "project",
    "jti": uuid.v4()
  };

  let token = jwt.encode(
    options,
    projectAPISecret,
    'HS256'
  );

  options = {
    method: 'GET',
    uri: url,
    headers: {
      'X-OPENTOK-AUTH': token,
    }
  }

  return request(options, function (error, response) { 
    if (error) {
      log.warn("Error fetching opentok archives ", error)
      return res.status(500).json({
        message: 'Opentok api error'
      })
    }
    const archives = JSON.parse(response.body);
    const archiveList = archives.items.map(archive => {
      return `https://s3.console.aws.amazon.com/s3/buckets/indorphins-session-archive/${archiveAPIKey}/${archive.id}/?region=us-east-1`;
    })
    return res.status(200).json(archiveList);
  });
}

async function startArchive(req, res) {
  const sessionId = req.params.id;

  const options = {
    outputMode: 'individual',
  }
  opentok.startArchive(sessionId, options, (error, archive) => {
    if (error) {
      log.warn("Error starting archive ", error)
      return res.status(500).json(error);
    }
    return res.status(200).json(archive);
  })
}

async function stopArchive(req, res) {
  const archiveId = req.params.id;

  opentok.stopArchive(archiveId, (error, archive) => {
    if (error) {
      log.warn("Error stopping archive ", error)
      return res.status(500).json(error);
    }
    return res.status(200).json(archive);
  })
}

module.exports = {
  createSession,
  joinSession,
  fetchArchives,
  startArchive,
  stopArchive
};