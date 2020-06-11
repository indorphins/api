const uuid = require('uuid');
const User = require('../db/User');
const log = require('../log');

const knownAccounts = require('../db/known_accounts.json');

/**
 * Express handler to create a new user. Requires a valid firebase token so that we can properly associate
 * the user within our systems to the Firebase account.
 * @param {Object} req - http request object
 * @param {Object} res - http response object
 */
async function createUser(req, res) {
	let userData = req.body;
	let newUser = null;
	userData.id = uuid.v1();
	userData.created_date = new Date().toISOString();

	if (!req.ctx.userData || req.ctx.userData.type != 'admin') {
		userData.firebase_uid = req.ctx.firebaseUid;
		userData.type = 'standard';
	}

	// setup account type for static known accounts that might be created
	if (knownAccounts[userData.email]) {
		if (typeof knownAccounts[userData.email] === "object") {
			userData.type = knownAccounts[userData.email].type;
			userData.photo_url = knownAccounts[userData.email].photo_url
		} else {
			userData.type = knownAccounts[userData.email];
		}
	}

	try {
		newUser = await User.create(userData);
	} catch (err) {
		log.warn('createUser - error: ', err);
		return res.status(400).json({
			message: err,
		});
	}

	res.status(201).json({
		message: 'New user created',
		data: newUser,
	});
}

/**
 * Express handler to get a new user. Only authorized for the actual user.
 * @param {Object} req - http request object
 * @param {Object} res - http response object
 */
async function getUser(req, res) {

	if (!req.ctx.userData) {
		log.warn('valid token but user does not exist in db');
		return res.status(404).json({
			message: "user does not exist"
		});
	}

	let id = req.ctx.userData.id;

	if (req.params.id) {
		id = req.params.id;
	}

	let query = { id: id };
	let user;

	try {
		user = await User.findOne(query);
	} catch (err) {
		log.warn('getUser - error: ', err);
		return res.status(404).json({
			message: err,
		});
	}

	if (!user) {
		return res.status(404).json({
			message: 'User not found',
		});
	}

	res.status(200).json({
		data: user,
	});
}

/**
 * Express handler to update a user record. Only authorized for the actual user.
 * @param {Object} req - http request object
 * @param {Object} res - http response object
 */
async function updateUser(req, res) {
	let id = req.ctx.userData.id;

	if (req.params.id) {
		id = req.params.id;
	}

	let query = { id: id };
	let user = null;

	try {
		user = await User.findOne(query);
	} catch (err) {
		log.warn('updateUser - error: ', err);
		return res.status(500).json({
			message: 'Service error',
			error: err,
		});
	}

	if (!user) {
		log.debug('User not found');
		res.status(403).json({
			message: 'Forbidden',
		});
	}

	let data = req.body;

	if (data.type && req.ctx.userData.type != 'admin') {
		delete data.type;
	}

	try {
		await User.update(query, data, {
			upsert: true,
			new: false,
		});
	} catch (err) {
		log.warn('error updating user record', user);
		return res.status(400).json({
			message: 'Issue updating data',
			error: err,
		});
	}

	res.status(200).json({
		message: 'User data updated',
	});
}

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
	let id = req.ctx.userData.id;

	if (req.params.id) {
		id = req.params.id;
	}

	let query = { id: id };
	let user = null;

	try {
		user = await User.findOne(query);
	} catch (err) {
		log.warn('deleteUser - error: ', err);
		return res.status(404).json({
			message: err,
		});
	}

	if (!user) {
		log.debug('User not found');
		res.status(403).json({
			message: 'Forbidden',
		});
	}

	try {
		await User.deleteOne(query);
	} catch (err) {
		log.warn('deleteUser - error: ', err);
		return res.status(500).json({
			message: 'Service error',
			error: err,
		});
	}

	res.status(200).json({
		message: 'User removed',
	});
}

module.exports = {
	deleteUser,
	getUser,
	updateUser,
	createUser,
};
