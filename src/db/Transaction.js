const mongoose = require('mongoose');

const Transaction = new mongoose.Schema({
	classId: {
		type: String,
		required: true,
	},
	userId: {
		type: String,
		required: true,
	},
	stripeId: {
		type: String,
		required: true,
	},
	paymentId: {
		type: String,
		required: true,
		unique: true,
	},
	status: {
		type: String,
	},
});

module.exports = mongoose.model('Transaction', Transaction);
