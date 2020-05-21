const stripe = require('stripe')('sk_test_FO42DhPlwMhJpz8yqf0gpdyM00qA7LvJLJ');

const authenticate = (req, res) => {
	const { code, state } = req.query;

	// Assert the state matches the state you provided in the OAuth link (optional).
	if (!stateMatches(state)) {
		return res
			.status(403)
			.json({ error: 'Incorrect state parameter: ' + state });
	}

	// Send the authorization code to Stripe's API.
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

const createPayment = async (req, res) => {
	const dest_acct = req.body.dest_acct;
	console.log('input dest_acct is ', dest_acct);
	// TODO validate dest acct id against our instructors' acct ids

	stripe.paymentIntents
		.create({
			payment_method_types: ['card'],
			amount: 1000,
			currency: 'usd',
			transfer_data: {
				destination: dest_acct, // where the money will go
			},
			on_behalf_of: dest_acct, // the account the money is intended for
			application_fee_amount: 250, // what we take
		})
		.then((paymentIntent) => {
			console.log('payment intent is ', paymentIntent);
			console.log('client secret is ', paymentIntent.client_secret);
			res
				.status(200)
				.json({ success: true, client_secret: paymentIntent.client_secret });
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

const generateState = () => {
	return 'sv_53124';
};

const stateMatches = (state_parameter) => {
	// Load the same state value that you randomly generated for your OAuth link.
	const saved_state = 'sv_53124';

	return saved_state == state_parameter;
};

const saveAccountId = (id) => {
	// Save the connected account ID from the response to your database.
	console.log('Connected account ID: ' + id);
};

const createCustomer = async (req, res) => {
	// Create a new customer object
	const email = req.body.email;
	try {
		const customer = await stripe.customers.create({
			email: email,
		});
		// save the customer.id in your database
		console.log('created customer ', customer);
		res.status(200).json({ customer });
	} catch (error) {
		console.log('Error creating customer ', error);
		res.status(400).json(error);
	}
};

const createSubscription = async (req, res) => {
  // Attach the payment method to the customer
  try {
    await stripe.paymentMethods.attach(req.body.paymentMethodId, {
      customer: req.body.customerId,
    });
  } catch (error) {
    return res.status('402').send({ error: { message: error.message } });
  }
​
  // Change the default invoice settings on the customer to the new payment method
  await stripe.customers.update(
    req.body.customerId,
    {
      invoice_settings: {
        default_payment_method: req.body.paymentMethodId,
      },
    }
  );
​
  // Create the subscription
  const subscription = await stripe.subscriptions.create({
    customer: req.body.customerId,
    items: [{ price: 'price_H1NlVtpo6ubk0m' }],
    expand: ['latest_invoice.payment_intent'],
  });
​
  res.send(subscription);
}

module.exports = {
	authenticate,
	createPayment,
	refundCharge,
	createCustomer,
};
