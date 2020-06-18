const mongoose = require('mongoose');

const StripeUser = new mongoose.Schema({
	// The user Id associated with a mongo User
	id: {
		type: String,
		required: true,
		unique: true,
	},
	// stripe id given when customer is created (sends payments)
	customerId: {
		type: String,
		unique: true,
		sparse: true,
	},
	// stripe id given when connect account created (receives payments)
	connectId: {
		type: String,
		unique: true,
		sparse: true,
	},
	paymentMethods: {
		type: Array,
		required: true,
	},
});

module.exports = mongoose.model('StripeUser', StripeUser);
