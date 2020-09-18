const mongoose = require('mongoose');
const db = require('../../src/db');
const Session = require('../../src/db/Session');
const { v4: uuidv4 } = require('uuid');

const types = ["Ballet", "Boxing", "Aerobics"]
const instructorId = "9bbacc10-d85d-11ea-8161-f36c28222179";
const participants = [
  instructorId,
  "05805490-d849-11ea-8161-f36c28222179",
  "36ca5d00-d84b-11ea-8161-f36c28222179",
  "asdfasdfasdgasfd",
  "qowieuytlqerwng"
];

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

/**
 * create properly formatted event for sessions collection
 * @param {Date} date 
 * @param {String} type 
 */
function createEvent(id, date, type) {
  let joined = participants;
  return {
    instructor_id: id,
    class_id: uuidv4(),
    session_id: uuidv4(),
    users_enrolled: participants,
    users_joined: joined,
    start_date: date,
    type: type,
  }
}

/**
 * generate given number of events with consecutive daily start dates
 * @param {Number} number - event count
 */
function consecutive(number, period) {
  let events = [];

  for (var i = 1; i <= number; i++) {
    let d = new Date();
    d.setDate(d.getDate()-(i*period));
    let newSession = createEvent(instructorId, d, types[0]);
    events.push(newSession);
  }

  return events;
}

/**
 * generate given number of events with the same instructorId
 * @param {Number} number - event count
 */
function sameInstructor(number) {
  let events = [];

  for (var i = 0; i < number; i++) {
    let d = new Date();
    let newSession = createEvent(instructorId, d, types[0]);
    events.push(newSession)
  }

  return events;
}

/**
 * generate events for each global class type
 */
function classTypes() {
  let events = [];
  types.forEach(item => {
    let d = new Date();
    events.push(createEvent(instructorId, d, item));
  });
  return events;
}

function multipleInstructors(number) {

  let events = [].concat(sameInstructor(1));
  if (number > 1) {
    for (var i = 2; i <= number; i++) {
      let d = new Date();
      let evt = createEvent(uuidv4(), d, types[0]);
      events.push(evt);
    }
  }
  return events;
}
/**
 * Test entry point
 */
async function run() {

  let events = [];

  try {
    connect();
  } catch(e) {
    console.error(e)
  }

  events = events.concat(sameInstructor(5));
  events = events.concat(consecutive(30,1));
  events = events.concat(consecutive(10,7));
  events = events.concat(classTypes());
  events = events.concat(multipleInstructors(4));

  try {
    await Session.insertMany(events);
  } catch(e) {
    return console.error(e);
  }

  console.log("DONE");
  disconnect();
}

run();