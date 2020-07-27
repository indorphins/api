const mongoose = require('mongoose');
const { Int32 } = require('mongodb');

const Transaction = new mongoose.Schema({
  classId: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
  },
  paymentId: {
    type: String,
    required: true,
  },
  subscriptionId: {
    type: String,
  },
  status: {
    type: String,
  },
  created_date: {
    type: Date,
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
