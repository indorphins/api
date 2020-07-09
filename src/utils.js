const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const later = require('later');
const log = require('./log')

function getNextDate(rule, count, refDate) {
  later.date.UTC();
  let sched = later.parse.cron(rule);
  return later.schedule(sched).next(count, refDate);
}

function getPrevDate(rule, count, refDate) {
  later.date.UTC();
  let sched = later.parse.cron(rule);
  return later.schedule(sched).prev(count, refDate);
}

async function getProductPrices(sku, recurring) {
  const options = {
    product: sku,
    type: recurring ? 'recurring' : 'one_time',
  };
  let prices;

  try {
    prices = await stripe.prices.list(options);
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

async function createClassSku(course) {
  const classId = course.id;
  const options = {
    name: classId,
    metadata: {
      class_id: classId,
    },
  };

  let product;

  stripe.products.create(options)
    .then(product => {
      product = product;
      return createPrice(Number(course.cost) * 100, product.id, false);
    }).then(() => {
      return createPrice(Number(course.cost) * 100, product.id, true);
    }).then(() => {
      return product.id;
    }).catch(err => {
      throw err;
    });
}

/**
 * Replaces ${value1} ${value2} ... strings in the input string 
 * values is an object that with keys 'value1', 'value2' and the values being the
 * strings to interpolate with the given input string
 * @param {String} string 
 * @param {Object} values 
 */
function interpolate(string, values) {
  if (!string) {
    return '';
  }

  let final = string;
  Object.keys(values).forEach(key => {
    let value = values[key];
    if (typeof value === 'string') {
      const target = '${' + key + '}';

      const escapedTarget = target.replace(/(]${}])/g, '\\$1');
      result = result.replace(new RegExp(escapedTarget, 'g'), value);
    }
  });
  return final;
}

module.exports = {
  createClassSku,
  createPrice,
  getPrice,
  getNextDate,
  getPrevDate,
  getProductPrices,
  interpolate
}