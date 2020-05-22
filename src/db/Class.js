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

const ClassSchema = new mongoose.Schema({
	id: {
		type: String,
		required: true,
		unique: true,
	},
	title: {
		type: String,
		unique: true,
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

ClassSchema.index({ participants: 1 });
ClassSchema.index({ start_date: -1 });
ClassSchema.index({ end_date: -1 });
ClassSchema.index({ available_spots: -1 });
ClassSchema.index({ type: 1 });

module.exports = mongoose.model('Class', ClassSchema);
