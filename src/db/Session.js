const mongoose = require('mongoose');

const Session = new mongoose.Schema({
  class_id: {
    type: String,
    required: true
  },
  instructor_id: {
    type: String,
    required: true
  },
  session_id: {
    type: String,
    required: true
  },
  users_joined: {
    type: Array,
    required: true
  },
  users_enrolled: {
    type: Array,
  },
  start_date: {
    type: Date,
    required: true
  },
  type: {
    type: String,
    required: true
  }
});

Session.index({ class_id: 1 });
Session.index({ session_id: 1 });
Session.index({ class_id: 1, session_id: 1});
Session.index({ start_date: 1 });
Session.index({ type: 1 });

module.exports = mongoose.model('Session', Session);