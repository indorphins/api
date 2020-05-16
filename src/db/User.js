const uuid = require('uuid');
const mongoose = require('mongoose');

const User = new mongoose.Schema({
	_id: mongoose.Schema.Types.ObjectId,
	id: {
		type: String,
		required: true,
		unique: true,
		default: uuid.v4(),
	},
	username: {
		type: String,
		required: true,
	},
	first_name: {
		type: String,
		required: true,
	},
	last_name: {
		type: String,
		required: true,
	},
	email: {
		type: String,
		required: true,
		unique: true,
		lowercase: true,
	},
	phone_number: {
		type: String,
		unique: true,
		required: false,
	},
	user_type: {
		type: String,
		required: true,
	},
	firebase_uid: {
		type: String,
		required: true,
		unique: true,
	},
	profile_img: {
		type: String,
		required: false,
	},
	created_at: {
		type: Date,
		required: true,
		default: new Date().toISOString(),
	},
});

User.index({ username: 1 });

module.exports = mongoose.model('User', User);
