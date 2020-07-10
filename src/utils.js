const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const later = require('later');

const sessionWindow = 5;

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

async function createClassSku(course) {
  const classId = course.id;
  const options = {
    name: classId,
    metadata: {
      class_id: classId,
    },
  };

  return new Promise((done, reject) => {
    stripe.products.create(options)
      .then(product => {
        let priceData = {
          unit_amount: Number(course.cost) * 100,
          currency: 'usd',
          product: product.id,
        }

        if (course.recurring) {
          priceData.recurring = {interval: 'week'};
        }

        return stripe.prices.create(priceData);
      }).then(price => {
        done({
          product_sku: price.product,
          product_price_id: price.id, 
        });
      }).catch(err => {
        reject(err);
      });
  });
}

function getNextSession(now, c) {
  let start = new Date(c.start_date);
  let end = new Date(c.start_date);
  end.setMinutes(end.getMinutes() + c.duration);
  let startWindow = new Date(start.setMinutes(start.getMinutes() - sessionWindow));
  let endWindow = new Date(end.setMinutes(end.getMinutes() + sessionWindow));

  // if it's a recurring class and the first class is in the past
  if (c.recurring && now > endWindow) {

    // get the previous event date for the recurring class in case there is an
    // active session right now
    start = getPrevDate(c.recurring, 1, now);
    end = new Date(start);
    end.setMinutes(end.getMinutes() + c.duration);
    startWindow = new Date(start.setMinutes(start.getMinutes() - sessionWindow));
    endWindow = new Date(end.setMinutes(end.getMinutes() + sessionWindow));

    // if the prev session is over then get the next session
    if (now > endWindow) {
      start = getNextDate(c.recurring, 1, now);
      end = new Date(start);
      end.setMinutes(end.getMinutes() + c.duration);
      startWindow = new Date(start.setMinutes(start.getMinutes() - sessionWindow));
      endWindow = new Date(end.setMinutes(end.getMinutes() + sessionWindow));
    }
  }

  return {
    date: start,
    start: startWindow,
    end: endWindow,
  };
}
module.exports = {
  createClassSku,
  getNextDate,
  getPrevDate,
  getNextSession,
}