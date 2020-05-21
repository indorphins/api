const Class = require('../db/Class');
const log = require('../log');

/**
 * Express handler for getting existing classes. Supports a number of different query params for
 * filtering and sorting or different fields and parameters.
 * @param {Object} req - http request object
 * @param {Object} res - http response object
 */
async function getClasses(req, res) {
	
	let page = req.params.page ? Number(req.params.page) - 1 : 0;
	let limit = req.params.limit ? Number(req.params.limit) : 50;
	let order = {};

	// TODO: the filter could change more based on query params
	let filter = { start_date: { $gte : new Date().toISOString() }};

	// NOTE: only supporting one field to sort by ATM but this could be refined
	if (!req.params.sort) {
		order[start_date] = "desc";
	} else {
		order[req.params.sort] = "asc";

		if (req.params.order) {
			order[req.params.sort] = req.params.order;
		}
	}

	try {
		Class.find(filter).sort(order).skip(page*limit).limit(limit).exec((err, doc) => {
			if (err) {
				res.status(500).json(err);
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
		res.status(404).json({
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
		res.status(403).json({
			message: "forbidden",
		});
		return;
	}

	classData.created_date = new Date().toISOString();
	classData.instructor = req.ctx.userData;
	classData.participants = [];

	try {
		newClass = await Class.create(classData);
	} catch (err) {
		log.error('Error creating class: ', err);
		res.status(500).json({
			message: err,
		});
		return;
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
		res.status(403).json({
			message: "Forbidden",
		});
		return;
	}

	let c = null;

	try {
		c = await Class.findOneAndUpdate(
			{ _id: req.params.id },
			{ $set: req.body }
		);
	} catch (err) {
		log.warn("error updating class", err);
		res.status(404).json({
			message: "Class not found",
		});
		return;
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
