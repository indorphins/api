const mongoose = require('mongoose');

const Transaction = new mongoose.Schema({
  classId: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
  stripeId: {
    type: String,
    required: true,
  },
  paymentId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  subscriptionId: {
    type: String,
    unique: true,
    sparse: true
  },
  status: {
    type: String,
  },
  created_date: {
    type: Date,
    required: true
  },
  // Type values: debit, credit
  type: {
    type: String,
  },
});

Transaction.index({ created_date: 0 });
Transaction.index({ classId: 1, userId: 1 }); // Needed still?
Transaction.index({ classId: 1, userId: 1, type: 1 });

module.exports = mongoose.model('Transaction', Transaction);
