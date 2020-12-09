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
    type: String,
    required: true
  },
  // ACTIVE TRIAL CANCELLED PAYMENT_FAILED
  status: {
    type: String,
    required: true
  },  
  start_date: {
    type: Date,
  },
  created_date: {
    type: Date,
  },
  // item user bought - has price property with the price id
  item: {
    type: Object,
    required: true
  },
  // cost object containing amount and recurring
  cost: {
    type: Object,
    required: true
  },
  period_start: {
    type: Date,
    required: true
  }, 
  period_end: {
    type: Date,
    required: true
  },
  classes_left: {
    type: Number,
    required: true
  },
  max_classes: {
    type: Number,
    required: true
  },
  // payment intent id for the last invoice tied to this subscription
  latest_payment: {
    type: String
  }
});

module.exports = mongoose.model("Subscription", Sub);