const mongoose = require('mongoose');

const UserRef = new mongoose.Schema({
	id: {
		type: String,
		required: true,
	},
	username: {
		type: String,
		required: true,
	}
})

const ClassSchema = new mongoose.Schema({
	id: {
		type: String,
		required: true,
		unique: true,
	},
	title: {
		type: String,
		required: true,
	},
	description: {
		type: String,
		required: true,
	},
	type: {
		type: String,
		required: true,
	},
	instructor: { 
		type: mongoose.Schema.ObjectId, 
		ref: 'User',
	},
	participants: [UserRef],
	// Should be UTC date
	session: {
		type: String
	},
	created_date: {
		type: Date,
		required: true,
	},
	// Should be UTC date
	start_date: {
		type: Date,
	},
	end_date: {
		type: Date,
	},
	recurring: {
		type: String,
	},
	duration: {
		type: Number,
		required: true
	},
	total_spots: {
		type: Number,
		required: true
	},
	available_spots: {
		type: Number,
		required: true,
	},
	cost: {
		type: Number,
		required: true,
		default: 20.00,
	},
	photo_url: {
		type: String,
	}
});

ClassSchema.index({ participants: -1 });
ClassSchema.index({ start_date: 1 });
ClassSchema.index({ end_date: 1 });
ClassSchema.index({ recurring: 1 });
ClassSchema.index({ available_spots: -1 });
ClassSchema.index({ type: 1 });
ClassSchema.index({ duration: 1 });
ClassSchema.index({ id: 1, instructor: 1 });

module.exports = mongoose.model('Class', ClassSchema);
