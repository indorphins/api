const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const redis = require('redis');
const redisClient = redis.createClient(process.env.REDIS_CONNECTION);
const StripeUser = require('../db/StripeUser');
const User = require('../db/User');
const Class = require('../db/Class');
const Transaction = require('../db/Transaction');
const base64 = require('uuid-base64');
const { v4: uuidv4 } = require('uuid');
const log = require('../log');
const PAYMENT_PAID = 'fulfilled';
const PAYMENT_FAILED = 'failed';
const PAYMENT_CANCELLED = 'cancelled';
const PAYMENT_REFUNDED = 'refunded';
const ONE_TIME_CLASS_PRICE = 'price_1Gt1klG2VM6YY0SVf1lvBEBq';
const RECURRING_CLASS_PRICE = 'price_1Gt1kmG2VM6YY0SVdXNBeMSJ';

redisClient.on('error', function (error) {
	console.error(error);
});

const TTL = 1200; // 20 mins

/**
 * Verifies state matches in redis, and stripe code is verified by stripe
 * Then creates a Stripe User with new connect ID. Redirects user back to profile page
 * With success or error message in query params
 * @param {Object} req
 * @param {Object} res
 */
async function authenticate(req, res) {
	const { code, state } = req.query;
	const PROFILE_REDIRECT = 'https://app.indorphins.com/profile';
	let userData;

	redisClient.get(state, function (err, reply) {
		log.info('Got reply redis : ', reply);
		if (err || !reply) {
			res.query;
			return res.redirect(PROFILE_REDIRECT + '?error=no_user_found');
		}
		userData = JSON.parse(reply);
	});

	stripe.oauth
		.token({
			grant_type: 'authorization_code',
			code,
		})
		.then(
			(response) => {
				var connected_account_id = response.stripe_user_id;

				createStripeUserConnectAcct(connected_account_id, userData)
					.then(() => {
						res.redirect(PROFILE_REDIRECT);
					})
					.catch((err) => {
						res.redirect(PROFILE_REDIRECT + '?error=create_account_failed');
					});
			},
			(err) => {
				if (err.type === 'StripeInvalidGrantError') {
					res.redirect(PROFILE_REDIRECT + '?error=invalid_auth_code');
				} else {
					res.redirect(PROFILE_REDIRECT + '?error=unknown_error');
				}
			}
		);
}

/**
 * Takes in a destination account and class id
 * Creates a stipe payment. Upon success sends data to
 * create a Transaction document in the db.
 * @param {Object} req
 * @param {Object} res
 * @param {Object} next
 */
async function createPayment(req, res, next) {
	const instructorId = req.body.instructor_id;
	const classId = req.body.class_id;
	const paymentMethod = req.body.payment_method;
	const userId = req.ctx.userData.id;

	if (!instructorId || !classId || !paymentMethod || !userId) {
		return res.status(400).json({
			message: 'Missing input parameters',
		});
	}

	let query = {
		id: instructorId,
	};
	let instructor, user, classObj, price;

	try {
		instructor = await StripeUser.findOne(query);
	} catch (err) {
		log.warn('createPayment find instructor stripe user - error: ', err);
		return res.status(404).json({
			message: err,
		});
	}

	query.id = userId;

	try {
		user = await StripeUser.findOne(query);
	} catch (err) {
		log.warn('createPayment find customer stripe user - error: ', err);
		return res.status(404).json({
			message: err,
		});
	}

	query = {
		id: classId,
	};

	try {
		classObj = await Class.findOne(query);
	} catch (err) {
		log.warn('createPayment find class - error: ', err);
		return res.status(404).json({
			message: err,
		});
	}

	if (!user.customerId || !classObj || !instructor.connectId) {
		const msg = !instructor.connectId
			? 'Invalid destination account'
			: !user.customerId
			? 'Invalid customer account'
			: 'Invalid class id';
		log.warn(msg);
		return res.status(400).json({
			message: msg,
		});
	}

	req.ctx.classData = {
		id: classId,
	};

	// Fetch the one-time payment cost - subscriptions handle recurring payment costs
	try {
		price = await getProductPrices(classObj.product_sku);
	} catch (err) {
		log.warn('CreatePayment - error fetching one-time price ', err);
		return res.status(400).json({
			message: 'Payment intent failure - invalid price',
		});
	}

	if (!price || !price[0]) {
		log.warn('CreatePaymentIntent - no prices for product found');
		return res.status(404).json({
			message: 'No price data found',
		});
	}

	// TODO how do we define application fee (what we take) and where?
	stripe.paymentIntents
		.create({
			payment_method_types: ['card'],
			amount: price[0].unit_amount,
			currency: 'usd',
			customer: user.customerId,
			transfer_data: {
				destination: instructor.connectId, // where the money will go
			},
			on_behalf_of: instructor.connectId, // the account the money is intended for
			application_fee_amount: 250, // what we take - stripe deducts their fee from this
			payment_method: paymentMethod,
			metadata: {
				class_id: classId,
			},
		})
		.then((paymentIntent) => {
			req.ctx.stripeData = {
				client_secret: paymentIntent.client_secret,
				paymentId: paymentIntent.id,
			};
			next();
		})
		.catch((error) => {
			log.warn('StripeController - createPayment - error : ', error);
			res.status(400).send(error);
		});
}

/**
 * Takes in a class id. Finds transaction using userId and classId
 * If transaction found and refund successful removes the user from class participant list
 * Stores refund data to req.ctx to update the transaction's status
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
async function refundCharge(req, res, next) {
	const classId = req.body.class_id;
	const userId = req.ctx.userData.id;

	let query = { classId: classId, userId: userId };
	let transaction, classObj;

	try {
		transaction = await Transaction.findOne(query);
	} catch (err) {
		log.warn('Stripe - refundCharge find transaction error: ', err);
		return res.status(400).json({
			message: err,
		});
	}

	if (!transaction) {
		return res.status(404).json({
			message: 'No transaction found',
		});
	}

	query = {
		id: classId,
	};

	try {
		classObj = Class.findOne(query);
	} catch (err) {
		log.warn('Stripe - refundCharge find class error: ', err);
		return res.status(404).json({
			message: err,
		});
	}

	if (!classObj) {
		return res.status(404).json({
			message: 'No class found',
		});
	}

	try {
		const refund = await stripe.refunds.create({
			charge: transaction.paymentId,
			reverse_transfer: true,
			refund_application_fee: true, // Gives back the platform fee
		});
		req.ctx.stripeData = {
			refund: refund,
			status: PAYMENT_REFUNDED,
			paymentId: transaction.paymentId,
		};
		next();
	} catch (err) {
		log.warn('Stripe - refundCharge create refund error: ', err);
		return res.status(400).json({
			message: err,
		});
	}
}

/**
 * Generate state code. Store in redis.
 * Also store in req.ctx to pass along to next call.
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
async function generateState(req, res, next) {
	let id = req.ctx.userData.id;

	if (req.params.id) {
		id = req.params.id;
	}

	let query = { id: id };

	try {
		user = await User.findOne(query);
	} catch (err) {
		log.warn('getUser - error: ', err);
		return res.status(404).json({
			message: err,
		});
	}

	if (!user) {
		return res.status(404).json({
			message: 'No user for token',
		});
	}

	// store state code in redis as [code: user-info] with expire time TTL
	const stateCode = base64.encode(uuidv4());
	redisClient.set(stateCode, JSON.stringify(user), function (error) {
		if (error) {
			log.warn('Error saving state in redis: ', error);
			return res.status(400).send(error);
		}
		redisClient.expire(stateCode, TTL);
		req.ctx.state = stateCode;
		next();
	});
}

/**
 * Creates the redirect url with a state code for
 * setup of stripe connect account and redirects to it.
 * @param {Object} req
 * @param {Object} res
 */
async function connectAccountRedirect(req, res) {
	const TEST_CLIENT_ID = 'ca_H6FI1hBlXQUv8wAMFBvSxGTNZUy7RiT1'; // TODO Maybe pass this in from Front End?
	const state = req.ctx.state;
	if (!state) {
		log.warn('getConnectAccountRedirectUrl - state code not found'); // TODO replace with client
		return res.status(400).json({
			message: 'No state code for redirect',
		});
	}
	const uri = `https://connect.stripe.com/express/oauth/authorize?client_id=${TEST_CLIENT_ID}&state=${state}&suggested_capabilities[]=card_payments&suggested_capabilities[]=transfers&stipe_user[]=`;
	// res.status(301).redirect(uri);
	res.status(200).json({
		redirectUrl: uri,
	});
}

// Save the connected account ID from the response to your database.
async function createStripeUserConnectAcct(id, userData) {
	try {
		const user = await StripeUser.create({ connectId: id, id: userData.id });
		return user;
	} catch (err) {
		log.warn('Sripe - saveAccountId error: ', err);
		throw err;
	}
}

/**
 * Takes in a user's email and creates a customer through stripe apis
 * Passes the customer data through via req.ctx.stripeData
 * @param {Object} req
 * @param {Object} res
 * @param {Object} next
 */
async function createCustomer(req, res, next) {
	const email = req.body.email;
	try {
		const customer = await stripe.customers.create({
			email: email,
		});
		req.ctx.stripeData = customer;
		next();
	} catch (error) {
		log.warn('Error creating customer ', error);
		res.status(400).json(error);
	}
}

/**
 * Takes in a payment method ID and customer id and attaches it to the customer
 * Fetches the payment method details and stores relevant data in req.ctx.stripeData
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
async function attachPaymentMethod(req, res, next) {
	try {
		const pMethodId = req.body.payment_method_id;
		const userId = req.ctx.userData.id;

		if (!pMethodId || !userId) {
			const msg =
				'Payment method ID and user ID required to attach payment method';
			log.warn(`attachPaymentMethod - ${msg}`);
			return res.status(400).json({
				message: msg,
			});
		}

		const query = { id: userId };
		let user;

		try {
			user = await StripeUser.findOne(query);
		} catch (err) {
			log.warn(err);
			return res.status(404).json({
				message: err,
			});
		}

		const pMethod = await stripe.paymentMethods.attach(pMethodId, {
			customer: user.customerId,
		});
		req.ctx.stripeData = {
			payment_method_id: pMethod.id,
			card_type: pMethod.card.brand,
			last_four: pMethod.card.last4,
		};
		next();
	} catch (err) {
		log.warn('Error attaching payment method ', err);
		res.status(400).json(err);
	}
}

/**
 * Takes in a payment method id and customer id and removes it from the customer
 * Stores the payment method id in req.ctx.stripeData
 * @param {Object} req
 * @param {Object} res
 * @param {*} next
 */
async function removePaymentMethod(req, res, next) {
	try {
		const pMethodId = req.body.payment_method_id;
		const userId = req.ctx.userData.id;

		if (!pMethodId || userId) {
			const msg =
				'Payment method ID and user ID required to remove payment method';
			log.warn(`removePaymentMethod - ${msg}`);
			res.status(400).json({
				message: msg,
			});
		}

		let user;
		const query = {
			id: userId,
		};

		try {
			user = await StripeUser.findOne(query);
		} catch (err) {
			log.warn(err);
			return res.status(404).json({
				message: err,
			});
		}

		const pMethod = await stripe.paymentMethods.detach(
			req.body.paymentMethodId,
			{
				customer: user.customerId,
			}
		);
		req.ctx.stripeData = {
			payment_method_id: pMethod.id,
		};
		next();
	} catch (err) {
		log.warn('Error creating customer ', error);
		res.status(400).json(error);
	}
}

async function createSubscription(req, res) {
	// Attach the payment method to the customer
	try {
		await stripe.paymentMethods.attach(req.body.paymentMethodId, {
			customer: req.body.customerId,
		});

		// Change the default invoice settings on the customer to the new payment method
		await stripe.customers.update(req.body.customerId, {
			invoice_settings: {
				default_payment_method: req.body.paymentMethodId,
			},
		});

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
}

async function retryInvoice(req, res) {
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
}

async function cancelSubscription(req, res) {
	// Delete the subscription
	const deletedSubscription = await stripe.subscriptions.del(
		req.body.subscriptionId
	);
	// Remove the subscription id from our database TODO
	res.send(deletedSubscription);
}

/**
 * Webhook for stripe event handling
 * receives an event and the relevant payment object
 * @param {Object} req
 * @param {Object} res
 */
async function stripeWebhook(req, res) {
	// Retrieve the event by verifying the signature using the raw body and secret.
	let event;
	try {
		event = stripe.webhooks.constructEvent(
			req.body,
			req.headers['stripe-signature'],
			process.env.STRIPE_WEBHOOK_SECRET // TODO add this
		);
		log.info('Stripe webhook event: ', event);
	} catch (err) {
		log.warn('Stripe Webhook error: ', err);
		return res.sendStatus(400);
	}
	// Extract the object from the event.
	const dataObject = event.data.object;
	// Handle the event

	if ((event.type = 'invoice.payment_succeeded')) {
		updateTransactionStatus(dataObject.id, PAYMENT_PAID)
			.then((transaction) => {
				// TODO determine how we're storing class id
				// return addUserToClass(dataObject.metadata.class_id, dataObject.customer);
			})
			.catch((error) => {
				log.warn('Stripe Webhook error - payment_intent.succeeded - ', error);
				return res.status(400).json({
					message: error,
				});
			});
	}
	if ((event.type = 'invoice.payment_failed')) {
		// If the payment fails or the customer does not have a valid payment method,
		//  an invoice.payment_failed event is sent, the subscription becomes past_due.
		// Use this webhook to notify your user that their payment has
		// failed and to retrieve new card details.
	}
	if ((event.type = 'invoice.finalized')) {
		// If you want to manually send out invoices to your customers
		// or store them locally to reference to avoid hitting Stripe rate limits.
	}
	if ((event.type = 'customer.subscription.deleted')) {
		if (event.request != null) {
			// handle a subscription cancelled by your request
			// from above.
		} else {
			// handle subscription cancelled automatically based
			// upon your subscription settings.
		}
	}
	if ((event.type = 'customer.subscription.trial_will_end')) {
		if (event.request != null) {
			// handle a subscription cancelled by your request
			// from above.
		} else {
			// handle subscription cancelled automatically based
			// upon your subscription settings.
		}
	}
	if ((event.type = 'payment_intent.succeeded')) {
		updateTransactionStatus(dataObject.id, PAYMENT_PAID)
			.then((transaction) => {
				return addUserToClass(
					dataObject.metadata.class_id,
					dataObject.customer
				);
			})
			.catch((error) => {
				log.warn('Stripe Webhook error - payment_intent.succeeded - ', error);
				return res.status(400).json({
					message: error,
				});
			});
	} else {
	}
	res.sendStatus(200);
}

/**
 * Updates a transaction status with input status string
 * Returns the updated transaction
 * @param {String} paymentId
 * @param {String} status
 */
async function updateTransactionStatus(paymentId, status) {
	const query = {
		id: paymentId,
	};
	try {
		const transaction = await Transaction.findOneAndUpdate(query, {
			status: status,
		});
	} catch (err) {
		log.warn('updateTransactionStatus - update transaction error: ', error);
		return res.status(404).json({
			message: err,
		});
	}

	if (!transaction) {
		log.warn('updateTransactionStatus - no transaction found');
		return res.status(404).json({
			message: 'No transaction found',
		});
	}

	return transaction;
}

/**
 * Adds a user to a class' participants array
 * Called after successful payment of participant for class
 * Sends response with class object
 * @param {String} classId
 * @param {String} stripeId
 */
async function addUserToClass(classId, stripeId) {
	let query = {
		customerId: stripeId,
	};
	let user;

	try {
		user = StripeUser.findOne(query);
	} catch (err) {
		log.warn('addUserToClass find stripe user error: ', err);
		return req.status(404).json({
			message: err,
		});
	}

	let c;
	try {
		c = await Class.findOneAndUpdate(
			{ id: classId },
			{ $push: { participants: user.id } }
		);
	} catch (err) {
		log.warn('addUserToClass add user to class error: ', err);
		return req.status(404).json({
			message: err,
		});
	}

	if (!c || !user) {
		log.warn('addUserToClass - User or Class not found');
		return req.send(404).json({
			message: 'User or Class not found',
		});
	}

	res.status(200).json({
		message: 'success',
		data: c,
	});
}

// Updates a user's subscription
async function updateSubscription(req, res) {
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
}

// Returns the invoice for a subscription id after a user has updated their subscription to a new one
async function retrieveUpcomingInvoice(req, res) {
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
}

// Returns payment method details for input paymentMethodId
async function retrieveCustomerPaymentMethod(req, res) {
	const paymentMethod = await stripe.paymentMethods.retrieve(
		req.body.paymentMethodId
	);
	res.send(paymentMethod);
}

/**
 * Finds transaction with input class ID and user ID
 * Confirms the payment intent and sets the stripe data in req.ctx
 * to update the Transaction status
 * @param {Object} req
 * @param {Object} res
 * @param {*} next
 */
async function confirmPayment(req, res, next) {
	const classId = req.body.class_id;
	const userId = req.ctx.userData.id;

	let query = { classId: classId, userId: userId };
	let transaction;

	try {
		transaction = await Transaction.findOne(query);
	} catch (err) {
		log.warn('Stripe - refundCharge find transaction error: ', err);
		return res.status(400).json({
			message: err,
		});
	}

	if (!transaction) {
		return res.status(404).json({
			message: 'No transaction found',
		});
	}
	// TODO eventually move payment confirmation to backend (currently happens on client side)
	req.ctx.stripeData = {
		paymentId: transaction.paymentId,
		status: PAYMENT_PAID,
	};
	next();
}

/**
 * Fetches the recurring/one-time prices associated with a product sku
 * Returns an array of price objects
 * @param {String} sku
 * @param {Boolean} recurring
 */
async function getProductPrices(sku, recurring) {
	try {
		const options = {
			product: sku,
			type: recurring ? 'recurring' : 'one_time',
		};
		const prices = await stripe.prices.list(options);
		log.info('Fetched stripe prices for sku ', sku);
		return prices.data;
	} catch (err) {
		log.warn('Stripe getProductPrices error : ', err);
		throw err;
	}
}

/**
 * Gets the stripe price object for a given price ID
 * Returns the JSON price object from stripe
 * @param {*} id
 */
async function getPrice(id) {
	try {
		const price = await stripe.prices.retrieve(id);
		log.info('Fetched stripe price for id: ', price);
		return price;
	} catch (err) {
		log.warn('Stripe get price error ', err);
		throw err;
	}
}

/**
 * Creates a price with cost "unitCost" and ties it to the product at "productSku"
 * Returns the JSON price object from stripe
 * @param {String} unitCost 1000 represents $10
 * @param {String} productSku
 * @param {Boolean} billingInterval
 */
async function createPrice(unitCost, productSku, recurring) {
	const options = {
		unit_amount_decimal: unitCost,
		currency: 'usd',
		product: productSku,
		billing_scheme: 'per_unit',
		nickname: `one-time payment for ${productSku}`,
	};

	// If recurring price - set up weekly billing
	if (recurring) {
		options.recurring = {
			interval: 'week',
		};
		options.nickname = `recurring payment for ${productSku}`;
	}

	try {
		const price = await stripe.prices.create(options);
		log.info('Created stripe price object ', price);
		return price;
	} catch (err) {
		log.warn('error creating stripe price object ', err);
		throw err;
	}
}

/**
 * Creates a product sku for a fitness class id. Pulls the price data from
 * the stripe price IDs set up as "Master Prices". Adds our Mongo Class ID to
 * the product's metadata. Can eventually add "name" and "statement_descriptor" fields
 * to better distinguish products once we have a good idea of the integration with classes.
 * Next function call should store the product sku with the Mongo Class.
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
async function createClassSku(req, res, next) {
	const classId = req.body.class_id;
	const options = {
		name: classId,
		metadata: {
			class_id: classId,
		},
	};

	stripe.products.create(options, function (err, product) {
		if (err) {
			return res.status(400).json({
				message: err,
			});
		}
		log.debug('Created new product sku ', product);

		// Fetch master prices for one-time and recurring payments & create duplicates to attach to new sku
		return getPrice(ONE_TIME_CLASS_PRICE)
			.then((priceObj) => {
				return createPrice(priceObj.unit_amount_decimal, product.id, false);
			})
			.then((priceObj) => {
				return getPrice(RECURRING_CLASS_PRICE);
			})
			.then((priceObj) => {
				return createPrice(priceObj.unit_amount_decimal, product.id, true);
			})
			.then(async (priceObj) => {
				log.info(
					'Successfully created new stripe product sku for class ',
					classId
				);
				const oneTime = await getProductPrices(product.id, false);
				const recur = await getProductPrices(product.id, true);
				console.log('RECURRING prices for product are ', recur);
				console.log('ONE TIME prices for product are ', oneTime);
				next();
			})
			.catch((err) => {
				log.warn('CreateClassSku error : ', err);
				res.status(400).json({
					message: err,
				});
			});
	});
}

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
	attachPaymentMethod,
	removePaymentMethod,
	confirmPayment,
	connectAccountRedirect,
	createClassSku,
};
