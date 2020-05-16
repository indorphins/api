const firebase = require('../auth');
const log = require('../log');
const User = require('../db/User');

function authentication(req, res, next) {

  if (!req.headers.authorization) {
    log.warn('Request missing authorization bearer token');
    res.status(403).json({
      message: "not authorized",
    });
  }
  
	const auth = req.headers.authorization.split(' ');
	if (auth.length < 2) {
    log.warn('Invalid authorization token format');
    res.status(403).json({
      message: "not authorized",
    });
  }

  const token = auth[1];

	firebase
		.verifyToken(token)
		.then((claims) => {
      log.debug("token claims", claims);
      req.ctx.firebaseUid = claims.uid;
      req.ctx.tokenClaims = claims;
      next();
		})
		.catch((error) => {
			log.warn('firebase token validation', error);
			res.status(403).json({
        message: "not authorized",
      });
		});
};

async function getUser(firebaseID) {
  let user = null;

  user = await User.findOne({ firebase_uid: firebaseID });

  return user;
}

function adminAuthorized(req, res, next) {

  // skip if already authorized by another middleware
  if (req.ctx.authorized) {
    next();
  }

  let firebase_uid = req.ctx.firebaseUid;
  let user = req.ctx.userData;
  
  if (!user) {
    user = getUser(firebase_uid);
    req.ctx.userData = user;
  }

  // if user is admin then set authorized true
  if (user && user.user_type == "admin") {
    req.ctx.authorized = true;
    log.debug("user is admin authorizing action");
  }

  next();
}

function instructorAuthorized(req, res, next) {

  // skip if already authorized by another middleware
  if (req.ctx.authorized) {
    next();
  }

  let firebase_uid = req.ctx.firebaseUid;
  let user = req.ctx.userData;
  
  if (!user) {
    user = getUser(firebase_uid);
    req.ctx.userData = user;
  }

  // if user is instructor then set authorized true
  if (user && user.user_type == "instructor") {
    req.ctx.authorized = true;
    log.debug("user is instructor authorizing action");
  }

  next();
}

module.exports = {
  authentication,
  adminAuthorized,
  instructorAuthorized,
};