const User = require('../db/User');
const log = require('../log');

/**
 * Express handler to create a new user. Requires a valid firebase token so that we can properly associate
 * the user within our systems to the Firebase account.
 * @param {Object} req - http request object
 * @param {Object} res - http response object
 */
async function createUser(req, res) {
	let userData = req.body;
	let newUser = null;

	userData.firebase_uid = req.ctx.firebase_uid;

	try {
		newUser = await User.create(req.body);
	} catch (err) {
		log.warn('createUser - error: ', err);
		res.status(400).json({
			message: err,
		});
		return;
	}

	res.status(201).json({
	  message: "New user created",
		data: newUser,
	});
};

/**
 * Express handler to get a new user. Only authorized for the actual user.
 * @param {Object} req - http request object
 * @param {Object} res - http response object
 */
async function getUser(req, res) {

	let query = { id: req.params.id };
	let user;

	try {
		user = await User.findOne(query)
	} catch (err) {
		log.warn('getUser - error: ', err);
		res.status(404).json({
			message: err,
		});
		return;
	}

	if (!user) {
		res.status(404).json({
			message: "User not found",
		});
	}

	// if the record doesn't belong to the requesting user reject the request
	if (!req.ctx.userData || (user.id != req.ctx.userData.id)) {
		log.debug('User not authorized', req.ctx.userData);
		res.status(403).json({
			message: "Forbidden",
		});
		return;
	}

	res.status(200).json({
		data: user,
	});
};

/**
 * Takes in an email from req.body and finds the user associated with it. Returns the user 
 * minus password field (can be deprecated once firebase handles user passwords)
 * @param {Object} req - http request object
 * @param {Object} res - http response object
 */
async function loginUser(req, res) {

	let firebaseID = req.params.firebaseUid;
	let user = null;

	try {
		user = await User.findOne({ firebase_uid: firebaseID }).populate(
			'classes'
		);
	} catch (err) {
		log.warn('getUser - error: ', err);
		res.status(403).json({
			message: "Forbidden"
		});
		return;
	}

	if (!user) {
		res.status(403).json({
			message: "Forbidden",
		});
	}

	res.status(200).json({
		message: "Successful login",
		data: user,
	});
};

/**
 * Express handler to update a user record. Only authorized for the actual user.
 * @param {Object} req - http request object
 * @param {Object} res - http response object
 */
async function updateUser(req, res) {
	
	let query = { id: req.params.id };
	let user = null;

	try {
		user = await User.findOne(query);
	} catch (err) {
		log.warn('updateUser - error: ', err);
		res.status(404).json({
			message: err,
		});
		return;
	}

	if (!user) {
		log.debug('User not found');
		res.status(403).json({
			message: "Forbidden",
		});
	}

	// if the record doesn't belong to the requesting user reject the request
	if (!req.ctx.userData || (user.id != req.ctx.userData.id)) {
		log.debug('User not authorized', req.ctx.userData);
		res.status(403).json({
			message: "Forbidden",
		});
		return;
	}

	try {
		await User.update(query, req.body, {
			upsert: true,
			new: false,
		});
	} catch(err) {
		
	}

	res.status(200).json({
		message: "User data updated"
	});
};

/**
 * Express handler to delete a user record. Only removes the user from the user collection, not any
 * user references that might exist in past or future classes.
 * TODO: This should require a user re-enter their password, which we could implement in the front, and then
 * here in the backend actually check the issue time of the token and see if it was very recently issued.
 * NOTE: Could potentially enable this for admins against any user
 * @param {Object} req - http request object
 * @param {Object} res - http response object
 */
async function deleteUser(req, res) {

	let user = null;

	try {
		user = await User.findOne({id: req.params.id});
	} catch (err) {
		log.warn('deleteUser - error: ', err);
		res.status(404).json({
			message: err,
		});
		return;
	}

	if (!user) {
		log.debug('User not found');
		res.status(403).json({
			message: "Forbidden",
		});
	}

	// if the record doesn't belong to the requesting user reject the request
	if (!req.ctx.userData || (user.id != req.ctx.userData.id)) {
		log.debug('User not authorized', req.ctx.userData);
		res.status(403).json({
			message: "Forbidden",
		});
		return;
	}

	try {
		await User.remove({id: req.params.id});
	} catch(err) {
		log.warn('deleteUser - error: ', err);
		res.status(404).json({
			message: err,
		});
		return;
	}

	res.status(204).json({
		message: "User removed",
	});
};



module.exports = {
	deleteUser,
	getUser,
	updateUser,
	createUser,
	loginUser,
};
