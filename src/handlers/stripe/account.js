const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../../db/User');
const StripeUser = require('../../db/StripeUser');
const redisClient = require('../../cache');
const { v1: uuidv1 } = require('uuid');
const log = require('../../log');
const auth = require('../../auth');

const TTL = 1200; // 20 mins

/**
 * Generate state code. Store in redis.
 * Also store in req.ctx to pass along to next call.
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
async function linkBankAccount(req, res) {
  const return_url = req.query.callbackURL
  const token = req.query.token;
  const CLIENT_ID = process.env.CONNECT_ACCT_CLIENT_KEY;
  let buff = new Buffer.from(uuidv1());
  let stateCode = buff.toString('base64');
  let redisValue;
  let stripeUser;

  let claims;
  
  try {
    claims = await auth.verifyToken(token);
  } catch(err) {
    log.warn("Validate firebase token", err);
    return res.redirect(return_url + '?error=Not+authorized:+' + encodeURIComponent(err.message));
  }

  if (!claims.uid) {
    return res.redirect(return_url + '?error=Not+authorized:+no+firebase+uid');
  }

  let user;

  try {
    user = await User.findOne({firebase_uid: claims.uid})
  } catch (err) {
    log.warn("No user record found for valid firebase token");
    return res.redirect(return_url + '?error=Not+authorized:+no+user+record');
  }

  redisValue = {
    user: user,
    return_url: return_url
  }

  try {
    // Check if user exists already and update if so
    stripeUser = await StripeUser.findOne({ id: user.id });
  } catch (err) {
    log.warn('Sripe - saveAccountId error: ', err);
    return res.redirect(return_url + '?error=Service+error:+'  + encodeURIComponent(error.message));
  }

  if (!stripeUser) {
    let customer = await stripe.customers.create({
      email: user.email,
    });

    let account = await stripe.accounts.create(  {
      type: 'custom',
      country: 'US',
      email: user.email,
      requested_capabilities: [
        'card_payments',
        'transfers',
      ],
    });

    let data = {
      id: user.id,
      paymentMethods: [],
      transactions: [],
      customerId: customer.id,
      accountId: account.id
    };
  
    try {
      stripeUser = await StripeUser.create(data);
    } catch (err) {
      log.warn('createStripeUser - error: ', err);
      return res.redirect(return_url + '?error=Service+error:+'  + encodeURIComponent(error.message));
    }
  }

  try {
    await redisClient.set(stateCode, JSON.stringify(redisValue), TTL);
  } catch(err) {
    log.warn('Error saving state in redis: ', error);
    return res.redirect(return_url + '?error=Service+error:+' + encodeURIComponent(error.message));
  }

  let uri = `https://connect.stripe.com/express/oauth/authorize`;
  uri = `${uri}?client_id=${CLIENT_ID}&state=${stateCode}`;
  uri = `${uri}&redirect_uri=${'http://localhost:3001/stripe/callback'}`;
  uri = `${uri}&stripe_user[email]=${user.email}`;
  uri = `${uri}&stripe_user[url]=https://indoorphins.fit`;
  uri = `${uri}&stripe_user[first_name]=${user.first_name}`;
  uri = `${uri}&stripe_user[last_name]=${user.last_name}`;
  uri = `${uri}&stripe_user[business_type]=individual`;
  uri = `${uri}&stripe_user[business_name]=Indoorphins`;

  log.debug('redirect URL', uri);
  res.redirect(301, uri);
}

/**
 * Verifies state matches in redis, and stripe code is verified by stripe
 * Then creates a Stripe User with new connect ID. Redirects user back to profile page
 * With success or error message in query params
 * @param {Object} req
 * @param {Object} res
 */
async function callback(req, res) {
  const { code, state } = req.query;
  let redisValue, cacheData;

  try {
    redisValue = await redisClient.get(state);
    cacheData = JSON.parse(redisValue);
  } catch(err) {
    return res.redirect('http://localhost:3000/?error=Service+error:+' + encodeURIComponent(error.message));
  }

  let userData = cacheData.user;
  let return_url = cacheData.return_url;

  stripe.oauth.token({grant_type: 'authorization_code', code})
    .then(response => {

      if (!response.stripe_user_id) throw Error("No stripe user exists is stripe");

      return StripeUser.findOneAndUpdate({ id: userData.id }, { accountId: response.stripe_user_id }, { new: true });
    })
    .then(() => {
      res.redirect(301, return_url);
    })
    .catch(err => {
      res.redirect(return_url + '?error=Service+error:+' + encodeURIComponent(err.message));
    });
}

module.exports = {
  linkBankAccount,
  callback
};