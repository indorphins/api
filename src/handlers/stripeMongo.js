const uuid = require('uuid');
const StripeUser = require('../db/StripeUser');
const Transaction = require('../db/Transaction');
const PaymentMethod = require('../db/PaymentMethod');
const constants = require('../constants');
const log = require('../log');

/**
 * Creates a Stripe User. Requires user data from token auth
 * and stripe data from creating a customer with stripe's API
 * @param {Object} req
 * @param {Object} res
 */
async function createStripeUser(req, res) {
	const userData = req.ctx.userData;
	const stripeData = req.ctx.stripeData;

	if (!userData.id || !stripeData) {
		res.status(400).json({
			message: 'Stripe and user data required',
		});
	}
	let newUser = null;
	let data = {
		id: userData.id,
		customerId: stripeData.customerId ? stripeData.customerId : null,
		connectId: stripeData.connectId ? stripeData.connectId : null,
		paymentMethods: [],
		transactions: [],
		subscriptions: [],
	};

	try {
		newUser = await StripeUser.create(data);
	} catch (err) {
		log.warn('createStripeUser - error: ', err);
		return res.status(400).json({
			message: err,
		});
	}

	res.status(201).json({
		message: 'New stripe user created',
		data: newUser,
	});
}

/**
 * Fetches a Stripe User based on their stripe ID
 * If no stripe ID provided, tries to fetch with user ID
 * TODO maybe just fetch by user id
 * @param {Object} req
 * @param {Object} res
 */
async function getStripeUser(req, res) {
	let id =
		req.ctx.stripeData && req.ctx.stripeData.id
			? req.ctx.stripeData.id
			: req.ctx.userData.id;

	let query = { id: id };
	let user;

	try {
		user = await StripeUser.findOne(query);
	} catch (err) {
		log.warn('getStripeUser - error: ', err);
		return res.status(404).json({
			message: err,
		});
	}

	if (!user) {
		return res.status(404).json({
			message: 'Stripe User not found',
		});
	}

	res.status(200).json({
		data: user,
	});
}

/**
 * Updates a Stripe user found with user id
 * @param {Object} req
 * @param {Object} res
 */
async function updateStripeUser(req, res) {
	let id = req.ctx.userData.id;

	if (req.params.id) {
		id = req.params.id;
	}

	let query = { id: id };
	let user = null;

	try {
		user = await StripeUser.findOne(query);
	} catch (err) {
		log.warn('updateStripeUser - error: ', err);
		return res.status(500).json({
			message: 'Service error',
			error: err,
		});
	}

	if (!user) {
		log.debug('Stripe User not found');
		res.status(403).json({
			message: 'Forbidden',
		});
	}

	let data = req.body;

	if (data.type && req.ctx.userData.type != 'admin') {
		delete data.type;
	}

	try {
		await StripeUser.update(query, data, {
			upsert: true,
			new: false,
		});
	} catch (err) {
		log.warn('error updating stripe user record', user);
		return res.status(400).json({
			message: 'Issue updating data',
			error: err,
		});
	}

	res.status(200).json({
		message: 'Stripe User data updated',
	});
}

/**
 * Deletes a Stripe User from our stripe user collection using their user ID
 * This doesn't delete the stripe customer with Stripe's APIs
 * @param {Object} req
 * @param {Object} res
 */
async function deleteStripeUser(req, res) {
	let id = req.ctx.userData.id;

	if (req.params.id) {
		id = req.params.id;
	}

	let query = { id: id };
	let user = null;

	try {
		user = await StripeUser.findOne(query);
	} catch (err) {
		log.warn('deleteStripeUser - error: ', err);
		return res.status(404).json({
			message: err,
		});
	}

	if (!user) {
		log.debug('User not found');
		res.status(403).json({
			message: 'Forbidden',
		});
	}

	try {
		await StripeUser.deleteOne(query);
	} catch (err) {
		log.warn('deleteStripeUser - error: ', err);
		return res.status(500).json({
			message: 'Service error',
			error: err,
		});
	}

	res.status(200).json({
		message: 'Stripe User removed',
	});
}

async function createTransaction(req, res) {
	const stripeData = req.ctx.stripeData;
	const userData = req.ctx.userData;
	const classData = req.ctx.classData;

	if (!userData.id || !stripeData.id || !classData.id) {
		res.status(400).json({
			message: 'Stripe, class, and user data required',
		});
	}
	let transaction = null;
	let data = {
		classId: classData.id,
		stripeId: stripeData.id,
		userId: userData.id,
		paymentId: stripeData.paymentId,
		status: constants.PAYMENT_CREATED,
	};

	try {
		transaction = await Transaction.create(data);
	} catch (err) {
		log.warn('createStripeUser - error: ', err);
		return res.status(400).json({
			message: err,
		});
	}

	let user;

	try {
		user = await StripeUser.findOneAndUpdate(
			{ id: userData.id },
			{ $push: { transactions: stripeData.paymentId } }
		);
	} catch (err) {
		log.warn(
			'update stripe user payment methods with new payment method - error: ',
			err
		);
		return res.status(400).json({
			message: err,
		});
	}

	if (!user) {
		log.warn('createTransaction - no user found');
		return res.status(404).json({
			message: 'No User found',
		});
	}

	res.status(201).json({
		message: 'New transaction created',
		data: { client_secret: req.ctx.stripeData.client_secret },
	});
}

async function updateTransaction(req, res) {
	const id = req.params.id ? req.params.id : null;
	const query = { id: id };
	let transaction = null;

	try {
		transaction = await Transaction.findOne(query);
	} catch (err) {
		log.warn('updateStripeUser - error: ', err);
		return res.status(500).json({
			message: 'Service error',
			error: err,
		});
	}

	if (!transaction) {
		log.debug('Transaction not found');
		res.status(403).json({
			message: 'Forbidden',
		});
	}

	let data = req.body;

	if (req.ctx.userData.type != 'admin') {
		return res.status(400).json({
			message: 'Only Admins can update transactions',
		});
	}

	try {
		await Transaction.update(query, data, {
			upsert: true,
			new: false,
		});
	} catch (err) {
		log.warn('error updating transaction record', transaction);
		return res.status(400).json({
			message: 'Issue updating transaction data',
			error: err,
		});
	}

	res.status(200).json({
		message: 'Transaction updated',
	});
}

/**
 * Creates a payment method. Requires user data from token auth
 * and payment method id from the request body
 * @param {Object} req
 * @param {Object} res
 */
async function createPaymentMethod(req, res) {
	const userData = req.ctx.userData;
	const { payment_method_id, card_type, last_four } = req.ctx.stripeData;

	if (!userData.id || !payment_method_id) {
		res.status(400).json({
			message: 'User and payment method info required',
		});
	}
	let newPaymentMethod = null;
	let data = {
		id: payment_method_id,
		last4: last_four,
		type: card_type,
		default: true,
	};

	// Create payment method document
	try {
		newPaymentMethod = await PaymentMethod.create(data);
	} catch (err) {
		log.warn('createPaymentMethod - error: ', err);
		return res.status(400).json({
			message: err,
		});
	}

	let user;

	// Add payment method ID to stripe user's payment method array
	try {
		user = await StripeUser.findOneAndUpdate(
			{ id: userData.id },
			{ $push: { paymentMethods: payment_method_id } }
		);
	} catch (err) {
		log.warn(
			'update stripe user payment methods with new payment method - error: ',
			err
		);
		return res.status(400).json({
			message: err,
		});
	}

	if (!user) {
		log.warn('createPaymentMethod - no user found');
		return res.status(404).json({
			message: 'No User found',
		});
	}

	res.status(201).json({
		message: 'New payment method created',
		data: newUser,
	});
}

async function getUserPaymentMethods(req, res) {
	let id = req.ctx.userData.id;

	if (!id) {
		return res.status(40).json({
			message: 'User ID required',
		});
	}

	let query = { id: id };
	let user;

	try {
		user = await StripeUser.find(query);
	} catch (err) {
		log.warn('getUserPaymentMethods - error: ', err);
		return res.status(404).json({
			message: err,
		});
	}

	let ids = [];
	query = {
		id: { $in: user.paymentMethods },
	};
	try {
		ids = await PaymentMethod.find(query);
	} catch (err) {
		log.warn('getUserPaymentMethods - error: ', err);
		return res.status(404).json({
			message: err,
		});
	}

	res.status(200).json({
		message: 'success',
		data: ids,
	});
}

/**
 * Fetches a payment method based on payment method id
 * @param {Object} req
 * @param {Object} res
 */
async function getPaymentMethod(req, res) {
	let id = req.params.id;

	if (!id) {
		return res.status(40).json({
			message: 'Payment Method ID required',
		});
	}

	let query = { id: id };
	let paymentMethod;

	try {
		paymentMethod = await PaymentMethod.findOne(query);
	} catch (err) {
		log.warn('getPaymentMethod - error: ', err);
		return res.status(404).json({
			message: err,
		});
	}

	if (!paymentMethod) {
		return res.status(404).json({
			message: 'Payment Method not found',
		});
	}

	res.status(200).json({
		data: paymentMethod,
	});
}

/**
 * Updates a payment method found with payment method id
 * @param {Object} req
 * @param {Object} res
 */
async function updatePaymentMethod(req, res) {
	let id = req.params.id;

	if (!id) {
		return res.status(40).json({
			message: 'Payment Method ID required',
		});
	}

	let query = { id: id };
	let paymentMethod = null;

	try {
		paymentMethod = await StripeUser.findOne(query);
	} catch (err) {
		log.warn('updatePaymentMethod - error: ', err);
		return res.status(500).json({
			message: 'Service error',
			error: err,
		});
	}

	if (!paymentMethod) {
		log.debug('Payment Method not found');
		res.status(403).json({
			message: 'Forbidden',
		});
	}

	let data = req.body;

	try {
		await PaymentMethod.update(query, data, {
			upsert: true,
			new: false,
		});
	} catch (err) {
		log.warn('error updating payment method record', paymentMethod);
		return res.status(400).json({
			message: 'Issue updating data',
			error: err,
		});
	}

	res.status(200).json({
		message: 'Payment Method data updated',
	});
}

/**
 * Deletes a payment method in our db found with payment method id
 * This doesn't delete the payment ID with Stripe's APIs
 * @param {Object} req
 * @param {Object} res
 */
async function deletePaymentMethod(req, res) {
	const userData = req.ctx.userData;
	const { payment_method_id } = req.ctx.stripeData;

	if (!userData.id || !payment_method_id) {
		res.status(400).json({
			message: 'User and payment method info required',
		});
	}

	let query = {
		id: payment_method_id,
	};

	try {
		await PaymentMethod.deleteOne(query);
	} catch (err) {
		log.warn('deletePaymentMethod - error: ', err);
		return res.status(400).json({
			message: err,
		});
	}

	let user;

	try {
		user = await StripeUser.findOneAndUpdate(
			{ id: userData.id },
			{ $pullAll: { paymentMethods: [payment_method_id] } }
		);
	} catch (err) {
		log.warn('removing payment method from stripe user - error: ', err);
		return res.status(400).json({
			message: err,
		});
	}

	if (!user) {
		log.warn('deletePaymentMethod - no user found');
		return res.status(404).json({
			message: 'No User found',
		});
	}

	res.status(200).json({
		message: 'Payment method removed',
	});
}

module.exports = {
	createStripeUser,
	updateStripeUser,
	deleteStripeUser,
	getStripeUser,
	createTransaction,
	updateTransaction,
	createPaymentMethod,
	getPaymentMethod,
	getUserPaymentMethods,
	deletePaymentMethod,
};
