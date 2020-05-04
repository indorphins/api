const MongoClient = require('mongodb').MongoClient;
const { CLASSES_DB, CLASSES_COLLECTION } = require('../constants');
const Class = require('../schemas/Class');

const uri =
	'mongodb+srv://dbAdmin:allthepower@cluster0-4mm8j.mongodb.net/test?retryWrites=true&w=majority';

const client = new MongoClient(uri, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
});

const getClasses = async (req, res) => {
	try {
		const classes = await Class.find();
		res.status(200).json({
			status: 'success',
			results: classes.length,
			data: { classes },
		});
	} catch (err) {
		res.status(404).json({
			status: 'fail',
			message: err,
		});
	}
};

const createClass = async (req, res) => {
	try {
		const newClass = await Class.create(req.body);
		console.log('new class is ', newClass);
		res.status(201).json({
			status: 'success',
			data: { class: newClass },
		});
	} catch (err) {
		console.log('Error creating class: ', err);
		res.status(400).json({
			status: 'fail',
			message: err,
		});
	}
};

const getClass = async (req, res) => {
	try {
		const c = await Class.findById(req.params.id);

		res.status(200).json({
			status: 'success',
			data: { c },
		});
	} catch (err) {
		res.status(404).json({
			status: 'fail',
			message: err,
		});
	}
};

const updateClass = async (req, res) => {
	try {
		console.log('UpdateClass req params: ', req.params);
		console.log('updateclass req body', req.body);
		const c = await Class.updateOne(
			{ name: req.params.id },
			{ $set: req.body }
		);

		res.status(200).json({
			status: 'success',
			data: { c },
		});
	} catch (err) {
		res.status(404).json({
			status: 'fail',
			message: err,
		});
	}
};

const deleteClass = async (req, res) => {
	try {
		await Class.findByIdAndDelete(req.params.id);
		res.status(204).json({
			status: 'success',
			data: null,
		});
	} catch (err) {
		res.status(404).json({
			status: 'fail',
			message: err,
		});
	}
};

module.exports = {
	deleteClass: deleteClass,
	updateClass: updateClass,
	getClass: getClass,
	getClasses: getClasses,
	createClass: createClass,
};
