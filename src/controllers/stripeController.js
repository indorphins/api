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

				// Render some HTML or redirect to a different page.
				return res.status(200).json({ success: true });
			},
			(err) => {
				if (err.type === 'StripeInvalidGrantError') {
					return res
						.status(400)
						.json({ error: 'Invalid authorization code: ' + code });
				} else {
					return res.status(500).json({ error: 'An unknown error occurred.' });
				}
			}
		);
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

module.exports = {
	authenticate,
};
