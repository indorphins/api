const stripe = require('stripe')('sk_test_FO42DhPlwMhJpz8yqf0gpdyM00qA7LvJLJ');
const redis = require('redis');
const redisClient = redis.createClient(process.env.REDIS_CONNECTION);
const StripeUser = require('../db/StripeUser');
const Class = require('../db/Class');
const stripeMongo = require('./stripeMongo');
const base64 = require('uuid-base64');
const { v4: uuidv4 } = require('uuid');
const log = require('../log');
const constants = require('../constants');

redisClient.on('error', function (error) {
	console.error(error);
});

const TTL = 1200; // 20 mins

const authenticate = (req, res) => {
	const { code, state } = req.query;
	console.log('Stipe auth w/ state ', state);

	if (!stateMatches(state)) {
		return res
			.status(403)
			.json({ error: 'Incorrect state parameter: ' + state });
	}

	stripe.oauth
		.token({
			grant_type: 'authorization_code',
			code,
		})
		.then(
			(response) => {
				var connected_account_id = response.stripe_user_id;
				saveAccountId(connected_account_id);

				res.status(200).json({ success: true });
			},
			(err) => {
				if (err.type === 'StripeInvalidGrantError') {
					res
						.status(400)
						.json({ error: 'Invalid authorization code: ' + code });
				} else {
					res.status(500).json({ error: 'An unknown error occurred.' });
				}
			}
		);
};

/**
 * Takes in a destination account and class id
 * Creates a stipe payment. Upon success sends data to
 * create a Transaction document in the db.
 * @param {Object} req
 * @param {Object} res
 * @param {Object} next
 */
const createPayment = async (req, res, next) => {
	const dest_acct = req.body.dest_acct;
	const classId = req.body.classId;

	let query = {
		connectId: dest_acct,
	};
	let user = null;
	let classObj = null;

	try {
		user = StripeUser.findOne(query);
	} catch (err) {
		log.warn('createPayment find stripe user - error: ', err);
		return res.status(404).json({
			message: err,
		});
	}

	query = {
		id: classId,
	};

	try {
		classObj = Class.findOne(query);
	} catch (err) {
		log.warn('createPayment find class - error: ', err);
		return res.status(404).json({
			message: err,
		});
	}

	if (!user || !classObj) {
		const msg = !user ? 'Invalid destination account' : 'Invalid class id';
		log.warn(msg);
		return res.status(400).json({
			message: msg,
		});
	}

	req.ctx.classData = {
		id: classId,
	};

	stripe.paymentIntents
		.create({
			payment_method_types: ['card'],
			amount: 1000, // TODO get price
			currency: 'usd',
			transfer_data: {
				destination: dest_acct, // where the money will go
			},
			on_behalf_of: dest_acct, // the account the money is intended for
			application_fee_amount: 250, // what we take - stripe deducts their fee from this
		})
		.then((paymentIntent) => {
			console.log('payment intent is ', paymentIntent);
			req.ctx.stripeData = {
				client_secret: paymentIntent.client_secret,
				paymentId: paymentIntent.id,
			};
			next();
		})
		.catch((error) => {
			console.log('StripeController - createPayment - error : ', error);
			res.status(400).send(error);
		});
};

const refundCharge = async (req, res) => {
	// How do we verify the charge is valid
	const refund = await stripe.refunds.create({
		charge: '{CHARGE_ID}',
		reverse_transfer: true,
		refund_application_fee: true, // Gives back the platform fee
	});
	res.status(200).json({ success: true, client_secret: refund.client_secret });
};

const generateState = async (req, res) => {
	// Get user from auth token
	console.log('COntext user data ', req.ctx.userData);
	// let id = req.ctx.userData.id;

	// if (req.params.id) {
	// 	id = req.params.id;
	// }

	// let query = { id: id };
	let user;

	// try {
	// 	user = await User.findOne(query);
	// } catch (err) {
	// 	log.warn('getUser - error: ', err);
	// 	return res.status(404).json({
	// 		message: err,
	// 	});
	// }

	user = {
		id: '123',
		data: 'Bite me',
	};

	if (!user) {
		return res.status(404).json({
			message: 'No user for token',
		});
	}
	// generate state code
	const stateCode = base64.encode(uuidv4());
	// store in redis as [code: user-info] with expire time TTL
	redisClient.hmset(stateCode, user, 'EX', TTL, function (error) {
		if (error) {
			console.log('Error saving state in redis: ', error);
			return res.status(400).send(error);
		}
		redisClient.expire(stateCode, TTL);
	});

	console.log('State: ', stateCode);
	console.log('User: ', user);
	res.status(200).json({ state: stateCode });
};

const stateMatches = (state) => {
	redis.get(state, function (err, reply) {
		console.log('Got reply redis : ', reply);
		if (err || !reply) {
			return false;
		}
		return true;
	});
};

const saveAccountId = (id) => {
	// Save the connected account ID from the response to your database.
	console.log('Connected account ID: ' + id);
};

const createCustomer = async (req, res, next) => {
	// Create a new customer object
	const email = req.body.email;
	try {
		const customer = await stripe.customers.create({
			email: email,
		});
		console.log('created customer ', customer);
		req.ctx.stripeData = customer;
		next();
	} catch (error) {
		console.log('Error creating customer ', error);
		res.status(400).json(error);
	}
};

const createSubscription = async (req, res) => {
	console.log('REQ BODY IS ', req.body);
	// Attach the payment method to the customer
	try {
		console.log('PAyment method id ', req.body.paymentMethodId);
		await stripe.paymentMethods.attach(req.body.paymentMethodId, {
			customer: req.body.customerId,
		});

		// TODO add payment method id to user
		console.log('update customer with invoice');

		// Change the default invoice settings on the customer to the new payment method
		await stripe.customers.update(req.body.customerId, {
			invoice_settings: {
				default_payment_method: req.body.paymentMethodId,
			},
		});

		console.log('create subscription');

		// Create the subscription
		const subscription = await stripe.subscriptions.create({
			customer: req.body.customerId,
			items: [{ price: req.body.priceId }],
			expand: ['latest_invoice.payment_intent'],
		});

		res.status(200).send(subscription);
	} catch (error) {
		return res.status('402').send({ error: { message: error.message } });
	}
};

const retryInvoice = async (req, res) => {
	// Set the default payment method on the customer
	try {
		await stripe.paymentMethods.attach(req.body.paymentMethodId, {
			customer: req.body.customerId,
		});
		await stripe.customers.update(req.body.customerId, {
			invoice_settings: {
				default_payment_method: req.body.paymentMethodId,
			},
		});
		const invoice = await stripe.invoices.retrieve(req.body.invoiceId, {
			expand: ['payment_intent'],
		});
		res.send(invoice);
	} catch (error) {
		// in case card_decline error
		return res
			.status('402')
			.send({ result: { error: { message: error.message } } });
	}
};

const cancelSubscription = async (req, res) => {
	// Delete the subscription
	const deletedSubscription = await stripe.subscriptions.del(
		req.body.subscriptionId
	);
	// Remove the subscription id from our database TODO
	res.send(deletedSubscription);
};

const stripeWebhook = async (req, res) => {
	// Retrieve the event by verifying the signature using the raw body and secret.
	let event;
	try {
		event = stripe.webhooks.constructEvent(
			req.body,
			req.headers['stripe-signature'],
			process.env.STRIPE_WEBHOOK_SECRET
		);
		console.log('Stripe webhook event: ', event);
	} catch (err) {
		console.log(err);
		console.log(`⚠️  Webhook signature verification failed.`);
		console.log(`⚠️  Check the env file and enter the correct webhook secret.`);
		return res.sendStatus(400);
	}
	// Extract the object from the event.
	const dataObject = event.data.object;
	// Handle the event
	switch (event.type) {
		case 'invoice.payment_succeeded':
			// Used to provision services after the trial has ended.
			// The status of the invoice will show up as paid. Store the status in your
			// database to reference when a user accesses your service to avoid hitting rate limits.
			break;
		case 'invoice.payment_failed':
			// If the payment fails or the customer does not have a valid payment method,
			//  an invoice.payment_failed event is sent, the subscription becomes past_due.
			// Use this webhook to notify your user that their payment has
			// failed and to retrieve new card details.
			break;
		case 'invoice.finalized':
			// If you want to manually send out invoices to your customers
			// or store them locally to reference to avoid hitting Stripe rate limits.
			break;
		case 'customer.subscription.deleted':
			if (event.request != null) {
				// handle a subscription cancelled by your request
				// from above.
			} else {
				// handle subscription cancelled automatically based
				// upon your subscription settings.
			}
			break;
		case 'customer.subscription.trial_will_end':
			if (event.request != null) {
				// handle a subscription cancelled by your request
				// from above.
			} else {
				// handle subscription cancelled automatically based
				// upon your subscription settings.
			}
		case 'payment_intent.succeeded':
			const paymentIntent = event.data.object;
			paymentSuccess(paymentIntent);
			break;
		default:
		// Unexpected event type
	}
	res.sendStatus(200);
};

// Add user to class - update transaction status to paid
const paymentSuccess = (paymentIntent) => {
	// Fulfill the purchase.
	console.log('paymentSuccess PaymentIntent: ' + JSON.stringify(paymentIntent));
};

// Updates a user's subscription
const updateSubscription = async (req, res) => {
	const priceId = req.body.priceId; // the new subscription
	const subscription = await stripe.subscriptions.retrieve(
		req.body.subscriptionId
	);
	const updatedSubscription = await stripe.subscriptions.update(
		req.body.subscriptionId,
		{
			cancel_at_period_end: false,
			items: [
				{
					id: subscription.items.data[0].id,
					price: priceId,
				},
			],
		}
	);
	res.send(updatedSubscription);
};

// Returns the invoice for a subscription id after a user has updated their subscription to a new one
const retrieveUpcomingInvoice = async (req, res) => {
	const priceId = req.body.priceId; // the new subscription
	const subscription = await stripe.subscriptions.retrieve(
		req.body.subscriptionId
	);
	const invoice = await stripe.invoices.retrieveUpcoming({
		subscription_prorate: true,
		customer: req.body.customerId,
		subscription: req.body.subscriptionId,
		subscription_items: [
			{
				id: subscription.items.data[0].id,
				deleted: true,
			},
			{
				// This price ID is the price you want to change the subscription to.
				price: priceId,
				deleted: false,
			},
		],
	});
	res.send(invoice);
};

// Returns payment method details for input paymentMethodId
const retrieveCustomerPaymentMethod = async (req, res) => {
	const paymentMethod = await stripe.paymentMethods.retrieve(
		req.body.paymentMethodId
	);
	res.send(paymentMethod);
};

module.exports = {
	authenticate,
	createPayment,
	refundCharge,
	createCustomer,
	createSubscription,
	retryInvoice,
	cancelSubscription,
	stripeWebhook,
	updateSubscription,
	retrieveUpcomingInvoice,
	retrieveCustomerPaymentMethod,
	cancelSubscription,
	generateState,
};
