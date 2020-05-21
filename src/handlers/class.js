const uuid = require('uuid');
const Class = require('../db/Class');
const log = require('../log');

/**
 * Utility function to decode a custom filter or sort order passed in through query parameters.
 * @param {String} value - base64 encoded and stringified json object representing a valid mongo filter or sort object
 */
function decodeQueryParam(value) {
	let buff = new Buffer.from(value, 'base64');
	let data = null;

	try {
		data = buff.toString('utf-8');
		data = JSON.parse(data);
	} catch(err) {
		log.warn("invalid encoded object", err);
		return null;
	}

	return data;
}

/**
 * Express handler for getting existing classes. Supports a number of different query params for
 * filtering and sorting or different fields and parameters.
 * TODO: should guard against searches that will go against non indexed fields
 * @param {Object} req - http request object
 * @param {Object} res - http response object
 */
async function getClasses(req, res) {
	
	let page = req.query.page ? Number(req.query.page) - 1 : 0;
	let limit = req.query.limit ? Number(req.query.limit) : 50;
	let order = /*{ start_date: "desc", name: "asc" };*/ {};
	let filter = /*{ start_date: { $gte : new Date().toISOString() }, available_spots: { $gt: 0 }}*/ {};

	if (req.query.filter) {
		let data = decodeQueryParam(req.query.filter);

		if (data) {
			filter = data;
		}
	}

	if (req.query.order) {
		let data = decodeQueryParam(req.query.order);

		if (data) {
			order = data;
		}
	}

	try {
		Class.find(filter).sort(order).skip(page*limit).limit(limit).exec((err, doc) => {
			if (err) {
				res.status(400).json(err);
				return;
			}

			res.status(200).json({
				total: doc.total,
				page: page + 1,
				limit: limit,
				data: doc,
			});
		});
	} catch (err) {
		res.status(500).json({
			message: err,
		});
	}
};

/**
 * Express handler to create a new class record. Action should only be allowed by
 * Admins and Instructors, not regular users.
 * @param {Object} req - http request object
 * @param {Object} res - http response object
 */
async function createClass(req, res) {

	let classData = req.body;
	let newClass = null;

	if (!req.ctx.authorized) {
		log.debug('User not authorized', req.ctx.userData);
		return res.status(403).json({
			message: "Forbidden",
		});
	}

	classData.id = uuid.v1();
	classData.created_date = new Date().toISOString();
	classData.instructor = req.ctx.userData;
	classData.participants = [];

	try {
		newClass = await Class.create(classData);
	} catch (err) {
		log.warn('Error creating class: ', err);
		return res.status(400).json({
			message: "issue creating class",
			error: err
		});
	}

	log.debug('New class created', newClass);
	res.status(201).json({
		message: "New class added",
		data: newClass,
	});
};

/**
 * Express handler to get a class record.
 * @param {Object} req - http request object
 * @param {Object} res - http response object
 */
async function getClass(req, res) {

	let filter = { id: req.params.id };
	let c = null;

	try {
		c = await Class.findOne(filter);
	} catch (err) {
		log.warn("error fetching class by id", err);
		res.status(404).json({
			message: "Class not found",
		});
		return;
	}

	res.status(200).json({
		data: c,
	});
};

/**
 * Express handler to update a class record. Only allowed by Admins and Instuctors.
 * @param {Object} req - http request object
 * @param {Object} res - http response object
 */
async function updateClass(req, res) {

	if (!req.ctx.authorized) {
		log.debug('User not authorized', req.ctx.userData);
		return res.status(403).json({
			message: "Forbidden",
		});
	}

	let c = null;

	try {
		c = await Class.findOneAndUpdate(
			{ _id: req.params.id },
			{ $set: req.body }
		);
	} catch (err) {
		log.warn("error updating class", err);
		return res.status(404).json({
			message: "Class not found",
		});
	}

	res.status(200).json({
		message: "Class updated"
	});
};

/**
 * Express handler to delete a class. Only allowed by Admins and Instructors.
 * @param {Object} req - http request object
 * @param {Object} res - http response object
 */
async function deleteClass(req, res) {

	// Has user been authorized by middleware
	if (!req.ctx.authorized) {
		log.debug('User not authorized', req.ctx.userData);
		res.status(403).json({
			message: "Forbidden",
		});
		return;
	}

	let filter = { id: req.params.id };
	let c = null;

	// Check for class
	try {
		c = await Class.findOne(filter);
	} catch (err) {
		res.status(404).json({
			message: "Class not found",
			error: err
		});
		return;
	}

	// Make sure class isn't null
	if (!c) {
		res.status(404).json({
			message: "Class not found",
		});
		return;
	}

	// Check if class has signed up participants
	// TODO: work out a scheme for refunds.
	if (c.participants.length > 0) {
		res.status(400).json({
			message: "Cannot remove class, it has participants.",
		});
		return;
	}

	// Try to delete the db document
	try {
		await Class.remove(filter);
	} catch(err) {
		log.warn("error removing class", err);
		res.status(500).json({
			message: "Error removing class",
			error: err,
		});
		return;
	}

	res.status(204).json({
		message: "Class removed",
	});
};

module.exports = {
	deleteClass,
	updateClass,
	getClass,
	getClasses,
	createClass,
};
