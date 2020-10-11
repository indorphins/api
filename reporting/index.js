const process = require('process');
const mongoose = require('mongoose');
const db = require('../src/db');

const { returnRate, classAttendence, participantAvg, classFeedbackForms } = require("./sessions");
const { classBooking } = require("./transactions");
const { newUsers } = require("./users");
const { truncate } = require('fs');

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

reporting.index({ week: -1, year: -1, instructorId: 1 }, { unique: true});
mongoose.model('instructor', instructorReporting);

async function run() {
  console.log("Running queries");

  try {
    connect();
  } catch(e) {
    console.error(e)
    process.exit();
  }

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
    await returnRate();
    await participantAvg();
    await classFeedbackForms();
  } catch(err) {
    console.error(err);
    disconnect();
    return process.exit(1);
  }

  process.exit();
}

run();