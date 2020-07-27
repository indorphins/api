const sgMail = require('@sendgrid/mail');
const log = require('../log');
const utils = require('../utils');
const noreply = 'noreply@indorphins.com'
const support = 'support@indoorphins.fit'
const alex = 'alex@indorphins.com';

// TODO move to env vars when we set up sms
const fromPhone = '+14405368595'
const twilioSid = 'ACe46b62ea1e8b08524a9d1979f92bc3b5';
const twilioAuth = 'e5e7a9df9b26765da9a86db15c3155cc'
const smsClient = require('twilio')(twilioSid, twilioAuth);

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const classReminders = {
  participant: {
    nightBefore: {
      subject: '${classType} class with ${instructorName} tomorrow at ${classTime}',
      text: 'Hey ${participantName}, just a reminder: you’re set to take ${instructorName}’s ${classType} class at ${classTime} tomorrow! We’ll send you another reminder tomorrow morning and another reminder when the classroom opens. Have a great night!'
    },
    morningOf: {
      subject: '${classType} class with ${instructorName} tomorrow at ${classTime}',
      text: 'Hey ${participantName}, just a reminder: you’re set to take ${instructorName}’s ${classType} class at ${classTime} today! We’ll send you another reminder when the classroom opens!'
    },
    classOpen: {
      subject: '${instructorName}’s classroom is now open!',
      text: 'Hey ${participantName}, class will start at ${classTime}, but the classroom is open now. You can join here: ${classLink}!',
      sms: 'It’s go time, baby! ${instructorName}’s classroom is open now. We’ve emailed you a link to join class so you can easily join from your computer. See you soon!'
    },
  },
  instructor: {
    nightBefore: {
      subject: 'Reminder! ${classType} class tomorrow at ${classTime}',
      text: 'Hey ${instructorName}, just a reminder: you’re set to teach your ${classType} class at ${classTime} tomorrow! Make sure all of your equipment is charged & ready to go!'
    },
    morningOf: {
      subject: 'Reminder! You have ${classType} class is today at ${classTime}',
      text: 'Hey ${instructorName}, just a reminder: you’re set to teach your ${classType} class at ${classTime} today! We’ll send you another reminder when the classroom opens! '
    },
    preClassOpen: {
      subject: 'Time to get set up!',
      text: 'Hey ${instructorName}, your class will start at ${classTime}. Make sure your equipment is good to go and you’re ready to rumble. You’ll be able to join here: ${classLink}!'
    },
    classOpen: {
      sms: 'It’s go time, baby! Your classroom is open now. We’ve emailed you a link to join class so you can easily join from your computer. See you soon!'
    },
  }
};

/**
 * Takes in a date and gets the timestamp for 7pm the night before
 * @param {Date} classTime 
 */
function getNightBeforeTimestamp(classTime) {

}

/**
 * Takes in a date and gets the timestamp for 7am the morning of
 * @param {Date} classTime 
 */
function getMorningOfTimestamp(classTime) {

}

/**
 * Takes in a date gets the timestamp for 15 minutes before
 * @param {Date} classTime 
 */
function get15MinutesBeforeTimestamp(classTime) {

}

/**
 * Takes in a date gets the timestamp for 5 minutes before
 * @param {Date} classTime 
 */
function get5MinutesBeforeTimestamp(classTime) {

}

async function scheduleInstructorPreClassNotification(instructorName, classTime, classId, recipient) {
  const classLink = `${process.env.CLIENT_HOST}/class/${classId}`;
  const subject = classReminders.instructor.preClassOpen.subject;
  const text = utils.interpolate(classReminders.instructor.preClassOpen.text, { instructorName: instructorName, classTime: classTime, classLink: classLink })
  const timestamp = get15MinutesBeforeTimestamp(classTime);

  try {
    await sendEmail(recipient, alex, subject, text, '<p>' + text + '</p>', timestamp)
  } catch (err) {
    log.warn("Pre Class email failed to send ", err);
  }
}


async function scheduleClassOpenNotification(isInstructor, instructorName, classTime, participantName, classId, recipient, recipientPhone) {
  let subject, text, sms;
  if (isInstructor) {
    sms = classReminders.instructor.classOpen.sms
    return await sendSms(recipientPhone, fromPhone, sms);
  } else {
    const classLink = `${process.env.CLIENT_HOST}/class/${classId}`;
    subject = utils.interpolate(classReminders.participant.classOpen.subject, { instructorName: instructorName });
    text = utils.interpolate(classReminders.participant.classOpen.text, { participantName: participantName, classTime: classTime, classLink: classLink })
    sms = utils.interpolate(classReminders.participant.classOpen.sms, { instructorName: instructorName })
  }
  const timestamp = get5MinutesBeforeTimestamp(classTime);
  try {
    await sendEmail(recipient, alex, subject, text, '<p>' + text + '</p>', timestamp)
  } catch (err) {
    log.warn("Class Open email failed to send ", err);
  }

  try {
    await sendSms(recipientPhone, fromPhone, sms);
  } catch (err) {
    log.warn("Class Open sms failed to send ", err);
  }
}

async function scheduleNightBeforeNotification(isInstructor, classType, instructorName, classTime, participantName, recipient) {
  let subject, text;
  if (isInstructor) {
    subject = utils.interpolate(classReminders.instructor.nightBefore.subject, { classType: classType, classTime: classTime });
    text = utils.interpolate(classReminders.instructor.nightBefore.text, { instructorName: instructorName, classType: classType, classTime: classTime })
  } else {
    subject = utils.interpolate(classReminders.participant.nightBefore.subject, { classType: classType, instructorName: instructorName, classTime: classTime });
    text = utils.interpolate(classReminders.participant.nightBefore.text, { participantName: participantName, instructorName: instructorName, classType: classType, classTime: classTime })
  }
  const timestamp = getNightBeforeTimestamp(classTime);
  try {
    await sendEmail(recipient, alex, subject, text, '<p>' + text + '</p>', timestamp)
  } catch (err) {
    log.warn("Nightly email failed to send ", err);
  }
}

async function scheduleMorningOfNotification(isInstructor, classType, instructorName, classTime, participantName, recipient) {
  let subject, text;
  if (isInstructor) {
    subject = utils.interpolate(classReminders.instructor.morningOf.subject, { classType: classType, classTime: classTime });
    text = utils.interpolate(classReminders.instructor.morningOf.text, { instructorName: instructorName, classType: classType, classTime: classTime })
  } else {
    subject = utils.interpolate(classReminders.participant.morningOf.subject, { classType: classType, instructorName: instructorName, classTime: classTime });
    text = utils.interpolate(classReminders.participant.morningOf.text, { participantName: participantName, instructorName: instructorName, classType: classType, classTime: classTime })
  }
  const timestamp = getMorningOfTimestamp(classTime);
  try {
    await sendEmail(recipient, alex, subject, text, '<p>' + text + '<p>', timestamp)
  } catch (err) {
    log.warn("Nightly email failed to send ", err);
  }
}

/**
 * Takes an array of string emails and sends an email from sender
 * isMultiple is used to send individual emails to each address in recipients 
 * @param {Array} recipients 
 * @param {String} sender 
 * @param {String} subject 
 * @param {String} text 
 * @param {String} html 
 * @param {Boolean} isMultiple
 * @param {Timestamp} sendTime optional (must be within 72 hours from now)
 */
async function sendEmail(recipients, sender, subject, text, html, isMultiple, sendTime) {
  const msg = {
    to: recipients,
    from: sender,
    subject: subject,
    text: text,
    html: html,
  };

  if (sendTime) {
    msg.send_at = sendTime
  }

  try {
    const sent = await sgMail.send(msg, isMultiple)
    log.info("Send Email Success: ", sent);
  } catch (err) {
    log.warn("Error sending email: ", err);
    log.warn("Error sending email detail: ", err.response.body)
    throw err;
  }
};

async function sendSms(to, from, text) {
  smsClient.messages
    .create({
      body: text,
      from: from,
      to: to
    })
    .then(message => {
      log.info("Sent sms : ", message);
    }).catch(err => {
      log.warn("Error sending sms: ", err);
      throw err;
    })
}

module.exports = {
  sendEmail,
  sendSms
}