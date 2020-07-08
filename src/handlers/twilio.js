const sgMail = require('@sendgrid/mail');
const log = require('../log');
const utils = require('../utils');
const noreply = 'noreply@indorphins.com'
const support = 'support@indoorphins.fit'
const alex = 'alex@indorphins.com';

// TODO move to env vars
const testPhone = '+14405368595'
const twilioSid = 'ACe46b62ea1e8b08524a9d1979f92bc3b5';
const twilioAuth = 'e5e7a9df9b26765da9a86db15c3155cc'
const smsClient = require('twilio')(twilioSid, twilioAuth);


// const reminderMessages = {
//   classReminders: {
//     participant: {
//       nightBefore: {
//         subject: `${classType} class with ${instructorName} tomorrow at ${classTime}`,
//         text: `Hey ${participantName}, just a reminder: you’re set to take ${instructorName}’s ${classType} class at ${classTime} tomorrow! We’ll send you another reminder tomorrow morning and another reminder when the classroom opens. Have a great night!`
//       },
//       morningOf: {
//         subject: `${classType} class with ${instructorName} tomorrow at ${classTime}`,
//         text: `Hey ${participantName}, just a reminder: you’re set to take ${instructorName}’s ${classType} class at ${classTime} today! We’ll send you another reminder when the classroom opens!`
//       },
//       classOpen: {
//         subject: `${instructorName}’s classroom is now open!`,
//         text: `Hey ${participantName}, class will start at ${classTime}, but the classroom is open now. You can join here: ${classLink}!`,
//         sms: `It’s go time, baby! ${instructorName}’s classroom is open now. We’ve emailed you a link to join class so you can easily join from your computer. See you soon!`
//       },
//     },
//     instructor: {
//       nightBefore: {
//         subject: `Reminder! ${classType} class tomorrow at ${classTime}`,
//         text: `Hey ${instructorName}, just a reminder: you’re set to teach your ${classType} class at ${classTime} tomorrow! Make sure all of your equipment is charged & ready to go!`
//       },
//       morningOf: {
//         subject: `Reminder! You have ${classType} class is today at ${classTime}`,
//         text: `Hey ${instructorName}, just a reminder: you’re set to teach your ${classType} class at ${classTime} today! We’ll send you another reminder when the classroom opens! `
//       },
//       preClassOpen: {
//         subject: `Time to get set up!`,
//         text: `Hey ${instructorName}, your class will start at ${classTime}. Make sure your equipment is good to go and you’re ready to rumble. You’ll be able to join here: ${classLink}!`
//       },
//       classOpen: {
//         subject: `${instructorName}’s classroom is now open!`,
//         text: `Hey ${participantName}, class will start at ${classTime}, but the classroom is open now. You can join here: ${classLink}!`,
//         sms: `It’s go time, baby! Your classroom is open now. We’ve emailed you a link to join class so you can easily join from your computer. See you soon!`
//       },
//     }
//   }
// }

// Set up domain authentication OR a single sender email from @indorphins 
async function sendEmail(recipient, sender, subject, text, html) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log("Set api key w/ secret ", process.env.SENDGRID_API_KEY)
  const msg = {
    to: recipient,
    from: sender,
    subject: subject,
    text: text,
    html: html
  };
  try {
    const sent = await sgMail.send(msg)
    log.info("Send Email Success: ", sent);
  } catch (err) {
    log.warn("Error sending email: ", err);
    log.warn("Error sending email body: ", err.response.body)
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
    })
}

module.exports = {
  sendEmail,
  sendSms
}