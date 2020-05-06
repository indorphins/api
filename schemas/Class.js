const uuid = require('uuid');
const mongoose = require('mongoose');

const Class = new mongoose.Schema({
	class_id: {
		type: String,
		required: true,
		default: uuid.v4(),
	},
	status: {
		type: String,
		required: true,
	},
	instructor_id: {
		type: String,
		required: true,
	},
	participants: {
		type: Array,
		required: true,
	},
	instructor_name: {
		type: String,
		required: true,
	},
	chat_room_name: {
		type: String,
		required: true,
	},
	created_at: {
		type: Date,
		required: true,
		default: Date.now,
	},
	start_time: {
		type: String,
		required: true,
	},
	total_spots: {
		type: Number,
		required: true,
	},
	duration: {
		type: Number,
		required: true,
	},
	instructor_img: {
		type: String,
		required: false,
	},
});

module.exports = mongoose.model('Class', Class);
