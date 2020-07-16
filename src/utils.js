//const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const later = require('later');

const sessionWindow = 5;
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

/*async function createClassSku(course) {
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
          priceData.recurring = { interval: 'week' };
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
}*/

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

function createClassEmailSubject(classTime, instructor) {
  const start = new Date(classTime);

  let startTime = start.getHours() + ':' + start.getMinutes();
  startTime = tConvert(startTime);
  return `Message from ${instructor} about your ${days[start.getDay()]} ${startTime} class`
}

// Return email sender's address - eventually will update and/or allow for parameters to determine email
function getEmailSender() {
  return 'indoorphins@indoorphins.fit';
}

function createDefaultMessageText(classTime, instructor) {
  const start = new Date(classTime);
  let startTime = start.getHours() + ':' + start.getMinutes();
  startTime = tConvert(startTime);
  return `This is a reminder that you have ${instructor}'s Indoorphins class on ${days[start.getDay()]} ${startTime}!`
}

function tConvert(time) {
  time = time.toString().match(/^([01]\d|2[0-3])(:)([0-5]\d)(:[0-5]\d)?$/) || [time];

  if (time.length > 1) {
    time = time.slice(1);
    time[5] = +time[0] < 12 ? 'am' : 'pm';
    time[0] = +time[0] % 12 || 12;
  }
  return time.join('');
}

module.exports = {
  //createClassSku,
  getNextDate,
  getPrevDate,
  interpolate,
  getNextSession,
  createClassEmailSubject,
  getEmailSender,
  createDefaultMessageText
}