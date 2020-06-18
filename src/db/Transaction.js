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
		unique: true,
	},
	subscriptionId: {
		type: String,
		unique: true,
	},
	status: {
		type: String,
	},
	// Type values: invoice, payment, subscription
	type: {
		type: String,
	},
});

Transaction.index({ classId: 1, userId: 1 }); // Needed still?
Transaction.index({ classId: 1, userId: 1, type: 1 });

module.exports = mongoose.model('Transaction', Transaction);
