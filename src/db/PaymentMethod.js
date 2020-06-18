const mongoose = require('mongoose');

const PaymentMethod = new mongoose.Schema({
	id: {
		type: String,
		required: true,
		unique: true,
	},
	userId: {
		type: String,
		required: true,
	},
	last4: {
		type: String,
		required: true,
	},
	type: {
		type: String,
		required: true,
	},
	default: {
		type: Boolean,
		required: true,
	},
});

PaymentMethod.index({ userId: 1, default: 1 });

module.exports = mongoose.model('PaymentMethod', PaymentMethod);
