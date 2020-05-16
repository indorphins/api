const uuid = require('uuid');
const mongoose = require('mongoose');

const User = new mongoose.Schema({
	// user_id	created_at	first_name	last_name	email	phone_number	password	user_type	venmo_handle	following	friends	classes	stripe_user_id	my_buddy_code	active_buddy_code	bio	insta_handle
	user_id: {
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
