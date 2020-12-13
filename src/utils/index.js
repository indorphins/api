const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

function getNextSession(now, c, /*optional*/ win) {
  let sw = sessionWindow;
  if (win) sw = win;
  let start = new Date(c.start_date);
  let end = new Date(c.start_date);
  end.setMinutes(end.getMinutes() + c.duration);
  let startWindow = new Date(start.setMinutes(start.getMinutes() - sw));
  let endWindow = new Date(end.setMinutes(end.getMinutes() + sw));

  // if it's a recurring class and the first class is in the past
  if (c.recurring && now > endWindow) {

    // get the previous event date for the recurring class in case there is an
    // active session right now
    start = getPrevDate(c.recurring, 1, now);
    end = new Date(start);
    end.setMinutes(end.getMinutes() + c.duration);
    startWindow = new Date(start.setMinutes(start.getMinutes() - sw));
    endWindow = new Date(end.setMinutes(end.getMinutes() + sw));

    // if the prev session is over then get the next session
    if (now > endWindow) {
      start = getNextDate(c.recurring, 1, now);
      end = new Date(start);
      end.setMinutes(end.getMinutes() + c.duration);
      startWindow = new Date(start.setMinutes(start.getMinutes() - sw));
      endWindow = new Date(end.setMinutes(end.getMinutes() + sw));
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
  return `Message from ${instructor}`
}

// Return email sender's address - eventually will update and/or allow for parameters to determine email
function getEmailSender() {
  return 'Indoorphins.fit <no-reply@indoorphins.fit>';
}

function createDefaultMessageText(classTime, instructor) {
  const start = new Date(classTime);
  let startTime = start.getHours() + ':' + start.getMinutes();
  startTime = tConvert(startTime);
  return `A friendly note from your neighborhood Indoorphins instructor ${instructor}!`
}

/**
 * Returns the subject text for class joined email notification
 * @param {Date} classDateTime
 * @param {*} instructor 
 */
function createClassJoinedSubject(classDateTime, instructor) {
  return `You're all set to take ${instructor}'s class on ${classDateTime}`;
}

/**
 * Returns the body text for class joined email notification
 * @param {String} participantName 
 * @param {Object} course
 */
function createClassJoinedBody(participantName, course, calendarLink) {
  return {
    text: `
      Hey ${participantName},

      We're excited to have you in class!

      Notes for class:
      - Use a laptop/computer for class
      - Set up close to your router: good wifi is important!
      - You can join 5 minutes before class starts here ${process.env.CLIENT_HOST}/login?redirect=/class/${course.id}
      
      Add this to your calendar so you don't forget!
    `, 
    html: `
      <p>Hey <strong>${participantName}</strong>,</p>
      <p>We&#x27;re excited to have you in class!</p>
      <p>Notes for class:</p>
      <p>
        <ul>
          <li>Use a laptop/computer for class</li>
          <li>Set up close to your router: good wifi is important!</li>
          <li>You can join 5 minutes before class starts <a href="${process.env.CLIENT_HOST}/login?redirect=/class/${course.id}">here</a></li>
        </ul>
      </p>
      <p>Add this to your calendar so you don&#x27;t forget!</p>
    `
  };
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

function isInteger(n) {
  return n === +n && n === (n|0);
}

module.exports = {
  createClassSku,
  getNextDate,
  getPrevDate,
  interpolate,
  getNextSession,
  createClassEmailSubject,
  getEmailSender,
  createDefaultMessageText,
  createClassJoinedSubject,
  createClassJoinedBody,
  isInteger,
  asyncForEach
}