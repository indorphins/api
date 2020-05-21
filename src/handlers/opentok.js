const OpenTok = require('opentok');
const log = require('../log');


function init() {
  let opentok = new OpenTok("46737292", "aa58ddf290d270e3284ddf9f574903d369f0d6c6");

  opentok.createSession({mediaMode:"routed"}, function(err, session) {
    if (err) {
      return log.error(err);
    }

    // save the sessionId
    //db.save('session', session.sessionId, done);
  });
}
