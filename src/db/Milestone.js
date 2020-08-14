const mongoose = require('mongoose');

const Milestone = new mongoose.Schema({
  user_id: {
    type: String
  },
  lives_changed: {
    type: Array,
  },
  days_changed: {
    type: Object,
  },
  classes_taught: {
    type: Number
  },
  dollars_earned: {
    type: Number
  },
  weeks_taught: {
    type: Object
  },
  users_referred: {
    type: Number
  },
  instructors_referred: {
    type: Number
  },
  classes_taken: {
    type: Number
  },
  weekly_streak: {
    type: Object
  },
  instructors_taken: {
    type: Object
  },
  nurture_classes: {
    type: Number
  }
});

module.exports = mongoose.model('Milestone', Milestone);