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
	if (!req.headers.authorization || req.headers.authorization == '') {
		log.debug('request missing authorization bearer token');
		return res.status(403).json({
			message: 'Forbidden',
		});
	}

	let auth = req.headers.authorization.split(' ');
	if (auth.length < 2) {
		log.debug('invalid authorization token format');
		return res.status(403).json({
			message: 'Forbidden',
		});
	}

	const token = auth[1];

	firebase
		.verifyToken(token)
		.then((claims) => {
			log.debug('token claims', claims);

			req.ctx.firebaseUid = claims.uid;
			req.ctx.tokenClaims = claims;

			return User.findOne({ firebase_uid: claims.uid });
		})
		.then((user) => {
			req.ctx.userData = user;

			next();
		})
		.catch((error) => {
			log.debug('firebase token validation', error);
			res.status(403).json({
				message: 'Forbidden',
			});
		});
}

/**
 * Custom express middleware that checks if a user's user type matches the one passed in, and
 * sets a context flag if the user should be authorized.
 * @param {String} user_type - a valid user type for the database User model (admin, instructor, user)
 * @param {Object} req - http request object
 * @param {Object} res - http response object
 * @param {Function} next - callback function to call when middleware is done
 */
async function isAuthorized(user_type, req, res, next) {
	let user = req.ctx.userData;
	let i = user_type.indexOf(user.type);

	// if user.user_type matches user_type then set authorized true
	if (user && i < 0) {
		req.ctx.authorized = true;
		log.warn('user not authorized', user_type);
		return res.status(403).json({
			message: 'Forbidden',
		});
	}

	next();
}

function adminAuthorized(req, res, next) {
	isAuthorized(['admin'], req, res, next);
}

function instructorAuthorized(req, res, next) {
	isAuthorized(['instructor'], req, res, next);
}

function adminOrInstructorAuthorized(req, res, next) {
	isAuthorized(['admin', 'instructor'], req, res, next);
}

module.exports = {
	authentication,
	adminAuthorized,
	instructorAuthorized,
	adminOrInstructorAuthorized,
};
