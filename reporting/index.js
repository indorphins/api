const process = require('process');
const mongoose = require('mongoose');
const db = require('../src/db');

const { returnRate, classAttendence, participantAvg, newParticipants, ecoSystemRate } = require("./sessions");
const { classFeedbackForms } = require("./feedback");
const { classBooking } = require("./transactions");
const { newUsers } = require("./users");
const { ARPU, monthlyARPU, promoCodes, userSessionsCollection, userTransactionsAgg, classCountBuckets } = require("./usersessions");
const { monthlyRetention, cohortSize, CustomerCount, NewCustomerCount } = require("./retention");

/**
 * disconnect from mongo DB at end of run
 */
function disconnect() {
  mongoose.connection.close();
}

/**
 * connect to mongo DB
 */
async function connect() {
  db.init((e) => {
    if (e) throw e;
    return;
  })
}

const reporting = new mongoose.Schema({
  week: {
    type: Number,
    required: true,
  },
  year: {
    type: Number,
    required: true,
  }
});

reporting.index({ week: -1, year: -1 }, { unique: true});
reporting.index({ startDate: -1, endDate: -1 }, { unique: true, sparse: true});
mongoose.model('reporting', reporting);

const instructorReporting = new mongoose.Schema({
  week: {
    type: Number,
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
  instructorId: {
    type: String,
    required: true,
  }
});

instructorReporting.index({ week: -1, year: -1, instructorId: 1 }, { unique: true});
instructorReporting.index({ startDate: -1, endDate: -1 }, { unique: false, sparse: true});
mongoose.model('instructorreporting', instructorReporting);

async function weekly() {

  try {
    await newUsers();
  } catch(err) {
    console.error(err);
    disconnect();
    return process.exit(1);
  }

  try {
    await classBooking();
    await classAttendence();
  } catch(err) {
    console.error(err);
    disconnect();
    return process.exit(1);
  }

  try {
    await participantAvg();
    await returnRate();
    await classFeedbackForms();
    await newParticipants();
    await ecoSystemRate();
  } catch(err) {
    console.error(err);
    disconnect();
    return process.exit(1);
  }

  disconnect();
  process.exit();
}

async function monthly() {
  try {
    /*await userSessionsCollection();
    await userTransactionsAgg();
    await monthlyRetention();
    await cohortSize();
    await monthlyARPU();*/

    /*let a = await ARPU();
    console.log(a);*/

    let b = await CustomerCount();
    console.log(b);

    let c = await NewCustomerCount();
    console.log(c);

    /*let c = await promoCodes();
    console.log(c);*/

  } catch(err) {
    console.error(err);
    disconnect();
    return process.exit(1);
  }

  disconnect();
  process.exit();
}

console.log("Running queries");

try {
  connect();
} catch(e) {
  console.error(e)
  process.exit();
}

//weekly();
monthly();
