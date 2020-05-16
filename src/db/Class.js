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
	status: {
		type: String,
		required: true,
	},
	instructor: { 
		type: mongoose.Schema.ObjectId, 
		ref: 'User',
	},
	participants: [UserRef],
	// Should be UTC date
	created_at: {
		type: Date,
		required: true,
		default: new Date().toISOString(),
	},
	// Should be UTC date
	start_time: {
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
	// minutes
	duration: {
		type: Number,
		required: true,
		default: 60
	},
});

Class.index({ participants: 1 });
Class.index({ status: 1 });
Class.index({ start_time: 1 });
Class.index({ available_spots: -1 });
Class.index({ class_id: 1, instructor: 1 });

module.exports = mongoose.model('Class', Class);
