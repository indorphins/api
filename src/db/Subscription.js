const mongoose = require('mongoose');

const Sub = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  class_id: {
    type: String,
    required: true
  },
  // user's id 
  user_id: {
    type: String
  },
  // user's stripe customer ID
  stripe_id: {
    type: String
  },
  status: {
    type: String
  }
});

module.exports = mongoose.model("Subscription", Sub);