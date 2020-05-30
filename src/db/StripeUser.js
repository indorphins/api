const mongoose = require('mongoose');

const StripeUser = new mongoose.Schema({
	id: {
		type: String,
		required: true,
		unique: true,
	},
	customerId: {
		type: String,
		unique: true,
	},
	connectId: {
		type: String,
		unique: true,
	},
	paymentMethods: {
		type: Array,
		required: true,
	},
	subscriptions: {
		type: Array,
		required: true,
	},
	transactions: {
		type: Array,
		required: true,
	},
});

module.exports = mongoose.model('StripeUser', StripeUser);
