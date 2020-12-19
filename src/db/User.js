const mongoose = require('mongoose');

const User = new mongoose.Schema({
	id: {
		type: String,
		required: true,
		unique: true,
	},
	username: {
		type: String,
		required: true,
	},
	first_name: {
		type: String,
	},
	last_name: {
		type: String,
	},
	city: {
		type: String,
	},
	state: {
		type: String,
	},
	bio: {
		type: String,
	},
	email: {
		type: String,
		required: true,
		unique: true,
		lowercase: true,
	},
	phone_number: {
		type: String,
		required: false,
		sparse: true,
	},
	type: {
		type: String,
		required: true,
	},
	firebase_uid: {
		type: String,
		required: true,
		unique: true,
	},
	photo_url: {
		type: String,
	},
	created_date: {
		type: Date,
		required: true,
	},
	social: {
		type: Object,
  },
  birthday: {
    type: String,
  },
  campaigns: {
    type: Array,
  }
});

User.index({ username: 1 });

module.exports = mongoose.model('User', User);
