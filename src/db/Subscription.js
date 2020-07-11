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
  status: {
    type: String,
  },
  created_date: {
    type: Date,
  }
});

module.exports = mongoose.model("Subscription", Sub);