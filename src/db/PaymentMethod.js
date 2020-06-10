const mongoose = require('mongoose');

const PaymentMethod = new mongoose.Schema({
	id: {
		type: String,
		required: true,
		unique: true,
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

module.exports = mongoose.model('PaymentMethod', PaymentMethod);
