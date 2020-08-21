const mongoose = require('mongoose');

const Session = new mongoose.Schema({
  class_id: {
    type: String
  },
  instructor_id: {
    type: String
  },
  session_id: {
    type: String
  },
  users_enrolled: {
    type: Array,
  },
  users_joined: {
    type: Array
  },
  start_date: {
    type: Date
  }
});

Session.index({ class_id: 1 });
Session.index({ session_id: 1 });
Session.index({ class_id: 1, session_id: 1});
Session.index({ start_date: 1 })

module.exports = mongoose.model('Session', Session);