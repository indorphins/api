const mongoose = require('mongoose');

const Sub = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  class_id: {
    type: String,
  },
  // user's id 
  user_id: {
    type: String
  },
  status: {
    type: String,
  },  
  start_date: {
    type: Date,
  },
  created_date: {
    type: Date,
  },
  item: {
    type: Object
  },
  cost: {
    type: Object
  },
  period_start: {
    type: Date
  }, 
  period_end: {
    type: Date
  },
  classes_left: {
    type: Number
  },
  max_classes: {
    type: Number
  }
});

module.exports = mongoose.model("Subscription", Sub);