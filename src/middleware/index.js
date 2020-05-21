const firebase = require('../auth');
const log = require('../log');
const User = require('../db/User');

/**
 * Custom express middleware that validates a firebase token and returns the firebase uid and full token
 * claims in the request context if the token is valid.
 * @param {Object} req - http request object
 * @param {Object} res - http response object
 * @param {Function} next - callback function to call when middleware is done
 */
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

      // create request context
      if (!req.ctx) {
        req.ctx = {};
      }

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

/**
 * Custom express middleware that checks if a user's user type matches the one passed in, and
 * sets a context flag if the user should be authorized.
 * @param {String} user_type - a valid user type for the database User model (admin, instructor, user)
 * @param {Object} req - http request object
 * @param {Object} res - http response object
 * @param {Function} next - callback function to call when middleware is done
 */
async function isAuthorized(user_type, req, res, next) {
    // skip if already authorized by another middleware
    if (req.ctx.authorized) {
      next();
    }
  
    let firebase_uid = req.ctx.firebaseUid;
    let user = req.ctx.userData;
    
    if (!user) {
      user = await User.findOne({ firebase_uid: firebase_uid });
      req.ctx.userData = user;
    }
  
    // if user.user_type matches user_type then set authorized true
    if (user && user.user_type == user_type) {
      req.ctx.authorized = true;
      log.debug("user action authorized for", user_type);
    }
  
    next();
}

function adminAuthorized(req, res, next) {
  isAuthorized("admin", req, res, next);
}

function instructorAuthorized(req, res, next) {
  isAuthorized("instructor", req, res, next)
}

module.exports = {
  authentication,
  adminAuthorized,
  instructorAuthorized,
};