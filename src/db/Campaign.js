const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    required: true,
  },
  referrerId: {
    type: String,
  },
  referrerDiscountRate: {
    type: Number,
  },
  referrerDiscountAmount: {
    type: Number,
  },
  referrerDiscountMultiplier: {
    type: Number,
  },
  discountRate: {
    type: Number,
  },
  discountAmount: {
    type: Number,
  },
  discountMultiplier: {
    type: Number,
  },
  active:  {
    type: Boolean,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  expires: {
    type: Date,
  },
  date: {
    type: Date,
    required: true,
  }
});

CampaignSchema.index({ referrerId: 1 });

module.exports = mongoose.model('Campaign', CampaignSchema);
