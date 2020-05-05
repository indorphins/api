const mongoose = require('mongoose');

const User = new mongoose.Schema({
	// user_id	created_at	first_name	last_name	email	phone_number	password	user_type	venmo_handle	following	friends	classes	stripe_user_id	my_buddy_code	active_buddy_code	bio	insta_handle
	user_id: {
		type: String,
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
	},
	phone_number: {
		type: String,
		required: true,
	},
	password: {
		type: String,
		required: true,
	},
	user_type: {
		type: Number,
		required: true,
	},
	classes: [{ type: mongoose.Schema.ObjectId, ref: 'Class' }],
	// classes: {
	// 	type: Array,
	// 	required: true,
	// 	default: [],
	// },
	created_at: {
		type: Date,
		required: true,
		default: Date.now,
	},
});

module.exports = mongoose.model('User', User);
