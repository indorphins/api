const OpenTok = require('opentok');
const Class = require('../db/Class');
const log = require('../log');

const APIKey = "46737292";
const opentok = new OpenTok(APIKey, "aa58ddf290d270e3284ddf9f574903d369f0d6c6");

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

function makeClientToken(sessionid, role, expire) {
  let options = {
    role: role,
  };

  if (expire) {
    options.expireTime = expire;
  }

  return opentok.generateToken(sessionid, options)
}

async function joinSession(req, res) {
  
	let filter = { id: req.params.id };
  let c;
  let sessionId;
  let token;

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

  sessionId = c.session;

  if (!sessionId) {
    return res.status(400).json({
			message: "Class not yet scheduled",
		});
  }
  
  try {
    token = await makeClientToken(sessionId, "publisher");
  } catch(err) {
    log.error("error generating session token", err)
    return res.status(500).json({
      message: ""
    });
  }

  res.status(200).json({
    sessionId: sessionId,
    token: token,
    apiKey: APIKey
  });
}

module.exports = {
  createSession,
  joinSession,
};