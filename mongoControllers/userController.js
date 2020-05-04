const User = require('../schemas/User');

const getUsers = async (req, res) => {
	try {
		const users = await User.find();
		res.status(200).json({
			status: 'success',
			results: users.length,
			data: { users },
		});
	} catch (err) {
		console.log('getUsers - error: ', err);
		res.status(404).json({
			status: 'fail',
			message: err,
		});
	}
};

const createUser = async (req, res) => {
	try {
		const newUser = await User.create(req.body);
		res.status(201).json({
			status: 'success',
			data: { class: newUser },
		});
	} catch (err) {
		console.log('createUser - error: ', err);
		res.status(400).json({
			status: 'fail',
			message: err,
		});
	}
};

const getUser = async (req, res) => {
	try {
		const user = await User.findById(req.params.id);

		res.status(200).json({
			status: 'success',
			data: { user },
		});
	} catch (err) {
		console.log('getUser - error: ', err);
		res.status(404).json({
			status: 'fail',
			message: err,
		});
	}
};

const updateUser = async (req, res) => {
	try {
		const query = { _id: req.params.id };
		const user = await User.findOneAndUpdate(query, req.body, {
			upsert: true,
			new: true,
		});

		res.status(200).json({
			status: 'success',
			data: { user },
		});
	} catch (err) {
		console.log('updateUser - error: ', err);
		res.status(404).json({
			status: 'fail',
			message: err,
		});
	}
};

const deleteUser = async (req, res) => {
	try {
		await User.findByIdAndDelete(req.params.id);
		res.status(204).json({
			status: 'success',
			data: null,
		});
	} catch (err) {
		console.log('deleteUser - error: ', err);
		res.status(404).json({
			status: 'fail',
			message: err,
		});
	}
};

module.exports = {
	deleteUser,
	getUser,
	getUsers,
	updateUser,
	createUser,
};
