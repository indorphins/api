const { CLASS_STATUS_SCHEDULED } = require('../constants');
const Class = require('../schemas/Class');

const getClasses = async (req, res) => {
	try {
		const classes = await Class.find();
		res.status(200).json({
			success: true,
			results: classes.length,
			data: { classes },
		});
	} catch (err) {
		res.status(404).json({
			success: false,
			message: err,
		});
	}
};

const getScheduledClasses = async (req, res) => {
	try {
		const classes = await Class.find({ status: /scheduled/ });
		res.status(200).json({
			success: true,
			results: classes.length,
			data: { classes },
		});
	} catch (err) {
		res.status(404).json({
			success: false,
			message: err,
		});
	}
};

const createClass = async (req, res) => {
	try {
		const newClass = await Class.create(req.body);
		console.log('new class is ', newClass);
		res.status(201).json({
			success: true,
			data: { class: newClass },
		});
	} catch (err) {
		console.log('Error creating class: ', err);
		res.status(400).json({
			success: false,
			message: err,
		});
	}
};

const getClass = async (req, res) => {
	try {
		const c = await Class.findById(req.params.id);

		res.status(200).json({
			success: true,
			data: { c },
		});
	} catch (err) {
		res.status(404).json({
			success: false,
			message: err,
		});
	}
};

const updateClass = async (req, res) => {
	try {
		const c = await Class.findOneAndUpdate(
			{ _id: req.params.id },
			{ $set: req.body }
		);

		res.status(200).json({
			success: true,
			data: { c },
		});
	} catch (err) {
		res.status(404).json({
			success: false,
			message: err,
		});
	}
};

const endClass = async (req, res) => {
	try {
		const c = await Class.findOneAndUpdate(
			{ _id: req.params.id },
			{ status: 'closed' },
			{ new: true }
		);

		res.status(200).json({
			success: true,
			data: { c },
		});
	} catch (err) {
		res.status(404).json({
			success: false,
			message: err,
		});
	}
};

const cancelClass = async (req, res) => {
	try {
		const c = await Class.findOneAndUpdate(
			{ _id: req.params.id },
			{ status: 'cancelled' },
			{ new: true }
		);

		res.status(200).json({
			success: true,
			data: { c },
		});
	} catch (err) {
		res.status(404).json({
			success: false,
			message: err,
		});
	}
};

const deleteClass = async (req, res) => {
	try {
		await Class.findByIdAndDelete(req.params.id);
		res.status(204).json({
			success: true,
			data: null,
		});
	} catch (err) {
		res.status(404).json({
			success: false,
			message: err,
		});
	}
};

module.exports = {
	deleteClass,
	updateClass,
	getClass,
	getClasses,
	createClass,
	getScheduledClasses,
	cancelClass,
	endClass,
};
