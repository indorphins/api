const mongoose = require('mongoose');

const Transaction = new mongoose.Schema({
  classId: {
    type: String,
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
  // Type values: debit (money to us), credit (money to user)
  type: {
    type: String,
  },
  campaignId: {
    type: String,
  }
});

Transaction.index({ created_date: 0 });
Transaction.index({ campaignId: 1 }, { sparse: true } );
Transaction.index({ classId: 1, userId: 1 });
Transaction.index({ userId: 1 });
Transaction.index({ classId: 1, userId: 1, type: 1 });

module.exports = mongoose.model('Transaction', Transaction);
