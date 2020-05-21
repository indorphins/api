const uuid = require('uuid');
const mongoose = require('mongoose');

const UserRef = new mongoose.Schema({
	user_id: {
		type: String,
		required: true,
	},
	username: {
		type: String,
		required: true,
	}
})

const Class = new mongoose.Schema({
	_id: mongoose.Schema.Types.ObjectId,
	id: {
		type: String,
		required: true,
		unique: true,
		default: uuid.v4(),
	},
	title: {
		type: String,
		required: true,
	},
	description: {
		type: String,
		required: true,
	},
	instructor: { 
		type: mongoose.Schema.ObjectId, 
		ref: 'User',
	},
	participants: [UserRef],
	// Should be UTC date
	created_date: {
		type: Date,
		required: true,
		default: new Date().toISOString(),
	},
	// Should be UTC date
	start_date: {
		type: Date,
	},
	end_date: {
		type: Date,
	},
	total_spots: {
		type: Number,
		required: true,
	},
	available_spots: {
		type: Number,
		required: true,
	},
	cost: {
		type: Number,
		required: true,
		default: 20.00,
	}
});

Class.index({ participants: 1 });
Class.index({ start_date: -1 });
Class.index({ end_date: -1 });
Class.index({ available_spots: -1 });
Class.index({ id: 1, instructor: 1 });

module.exports = mongoose.model('Class', Class);
