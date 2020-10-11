const process = require('process');
const mongoose = require('mongoose');
const db = require('../src/db');

const { returnRate, classAttendence, participantAvg } = require("./sessions");
const { classBooking } = require("./transactions");
const { newUsers } = require("./users");

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

async function run() {
  console.log("Running queries");

  try {
    connect();
  } catch(e) {
    console.error(e)
    process.exit();
  }

  let n = null;

  try {
    n = await newUsers();
  } catch(err) {
    console.error(err);
    disconnect();
    return process.exit(1);
  }

  console.log("\nData:\n", n);

  let trans;
  let att;

  try {
    trans = await classBooking();
    att = await classAttendence();
  } catch(err) {
    console.error(err);
    disconnect();
    return process.exit(1);
  }

  console.log("\nData:\n", trans);
  console.log("\nData:\n", att);

  let s;
  let avg;

  try {
    s = await returnRate();
    avg = await participantAvg();
  } catch(err) {
    console.error(err);
    disconnect();
    return process.exit(1);
  }

  console.log("\nData:\n", s);
  console.log("\nData:\n", avg);

  process.exit();
}

run();