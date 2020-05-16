const User = require('../db/User');

const createUser = async (req, res) => {
	try {
		const newUser = await User.create(req.body);
		res.status(201).json({
			success: true,
			data: { user: newUser },
		});
	} catch (err) {
		console.log('createUser - error: ', err);
		res.status(400).json({
			success: false,
			message: err,
		});
	}
};

const getUser = async (req, res) => {
	try {
		const user = await User.findById(req.params.id).populate('classes');

		res.status(200).json({
			success: true,
			data: { user },
		});
	} catch (err) {
		console.log('getUser - error: ', err);
		res.status(404).json({
			success: false,
			message: err,
		});
	}
};

/*
 * Takes in an email from req.body and finds the user associated with it
 * Returns the user minus password field (can be deprecated once firebase handles user passwords)
 */
const loginUser = async (req, res) => {
	try {
		const firebaseID = req.params.firebaseUid;
		const user = await User.findOne({ firebase_uid: firebaseID }).populate(
			'classes'
		);

		console.log('Got user - ', user);

		res.status(200).json({
			success: !user ? false : true,
			data: { user },
		});
	} catch (err) {
		console.log('getUser - error: ', err);
		res.status(404).json({
			success: false,
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
			success: true,
			data: { user },
		});
	} catch (err) {
		console.log('updateUser - error: ', err);
		res.status(404).json({
			success: false,
			message: err,
		});
	}
};

const deleteUser = async (req, res) => {
	try {
		await User.findByIdAndDelete(req.params.id);
		res.status(204).json({
			success: true,
			data: null,
		});
	} catch (err) {
		console.log('deleteUser - error: ', err);
		res.status(404).json({
			success: false,
			message: err,
		});
	}
};



module.exports = {
	deleteUser,
	getUser,
	updateUser,
	createUser,
	loginUser,
};
