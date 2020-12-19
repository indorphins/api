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
  // item user bought - has price property with the price id
  item: {
    type: Object
  },
  // cost object containing amount and recurring
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
  },
  // payment intent id for the last invoice tied to this subscription
  latest_payment: {
    type: String
  }
});

module.exports = mongoose.model("Subscription", Sub);