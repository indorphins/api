const mongoose = require('mongoose');

const PaymentMethods = new mongoose.Schema({
	userId: {
		type: Array,
		required: true,
	},
	methods: [{
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
		}
	}],
});

PaymentMethod.index({ userId: 1, default: 1 });

module.exports = mongoose.model('PaymentMethod', PaymentMethod);
