const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const StripeUser = require('../../db/StripeUser');
const redisClient = require('../../cache');
const base64 = require('uuid-base64');
const { v4: uuidv4 } = require('uuid');
const log = require('../../log');

const TTL = 1200; // 20 mins

/**
 * Generate state code. Store in redis.
 * Also store in req.ctx to pass along to next call.
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
async function linkBankAccount(req, res) {
  const return_url = req.body.return_url
  const user = req.ctx.userData;
  const CLIENT_ID = process.env.CONNECT_ACCT_CLIENT_KEY;
  let redisValue;
  let stripeUser;

  redisValue = {
    user: user,
    return_url: return_url
  }

  try {
    // Check if user exists already and update if so
    stripeUser = await StripeUser.findOne({ id: user.id });
  } catch (err) {
    log.warn('Sripe - saveAccountId error: ', err);
    return res.redirect(returnUrl + '?error=Service+error:+'  + encodeURIComponent(error.message));
  }

  if (!stripeUser) {
    let customer = await stripe.customers.create({
      email: user.email,
    });

    let data = {
      id: user.id,
      paymentMethods: [],
      transactions: [],
      customerId: customer.id,
    };
  
    try {
      stripeUser = await StripeUser.create(data);
    } catch (err) {
      log.warn('createStripeUser - error: ', err);
      return res.redirect(returnUrl + '?error=Service+error:+'  + encodeURIComponent(error.message));
    }
  }

  // store state code in redis as [code: user-info] with expire time TTL
  const stateCode = base64.encode(uuidv4());

  try {
    await redisClient.set(stateCode, JSON.stringify(redisValue), TTL);
  } catch(err) {
    log.warn('Error saving state in redis: ', error);
    return res.redirect(returnUrl + '?error=Service+error:+' + encodeURIComponent(error.message));
  }

  const uri = `https://connect.stripe.com/express/oauth/authorize?client_id=${CLIENT_ID}&state=${stateCode}&suggested_capabilities[]=card_payments&suggested_capabilities[]=transfers&stipe_user[]=`;
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
    return res.redirect(returnUrl + '?error=Service+error:+' + encodeURIComponent(error.message));
  }

  let userData = cacheData.user;
  let returnUrl = cacheData.return_url;

  stripe.oauth.token({grant_type: 'authorization_code', code})
    .then(response => {

      if (!response.stripe_user_id) throw Error("No stripe user exists is stripe");

      return StripeUser.findOneAndUpdate({ id: userData.id }, { connectId: response.stripe_user_id }, { new: true });
    })
    .then(() => {
      res.redirect(301, returnUrl);
    })
    .catch(err => {
      res.redirect(returnUrl + '?error=Service+error:+' + encodeURIComponent(err.message));
    });
}

module.exports = {
  linkBankAccount,
  callback
};