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
	accountId: {
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
		},
		brand: {
			type: String,
		},
		type: {
			type: String,
			required: true,
		},
		exp_month: {
			type: String,
		},
		exp_year: {
			type: String,
		},
		default: {
			type: Boolean,
			required: true,
		}
	}],
});

module.exports = mongoose.model('StripeUser', StripeUser);
