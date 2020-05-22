const OpenTok = require('opentok');
//const Class = require('../db/Class');
const log = require('../log');

const opentok = new OpenTok("46737292", "aa58ddf290d270e3284ddf9f574903d369f0d6c6");

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
    expireTime: expire,
  };

  return opentok.generateToken(sessionid, options)
}

async function joinSession() {
  
  let session;

  try {
    session = await createSession();
  } catch(err) {
    log.warn("error creating opentok session", err);
    return res.status(500).json({
      message: "Service error",
      error: err,
		});
  }


}

module.exports = {
  createSession,
  joinSession,
};