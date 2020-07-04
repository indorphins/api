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

module.exports = mongoose.model('StripeUser', StripeUser);
