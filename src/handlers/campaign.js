const Campaign = require('../db/Campaign');
const base62 = require("base62/lib/ascii");
const log = require('../log');

// Creates a refer a friend campaign, overwriting any that may exist already for the user
async function referFriend(req, res) {
  const userData = req.ctx.userData;

  let id;

  try {
    id = await getCampaignId();
  } catch (err) {
    log.warn("Database error creating campaign id ", err);
    res.status(500).json({
      message: "Database error creating campaign id"
    })
  }

  const newCampaign = {
    id: id,
    referrerId: userData.id,
    discountAmount: 500,
    discountMultiplier: 4,
    referrerDiscountAmount: 1000,
    referrerDiscountMultiplier: 1,
    newUser: true,
    description: "Get $$ for you and your friends when they book a class with your code.",
    active: true
  };
  
  let campaign;

  try {
    campaign = await Campaign.findOneAndUpdate({referrerId : newCampaign.referrerId}, newCampaign, {upsert: true});
  } catch (err) {
    log.warn("Database error creating campaign ", err);
    res.status(500).json({
      message: "Database error creating campaign"
    })
  }

  res.status(200).json(campaign.id);
}

// Create a new random campaign id by base62 encoding a randomly large number
// Checks if the campaign exists with new id, recursively calls itself to create a new one
async function getCampaignId() {
  const num = Math.floor(Math.random() * 1e13);
  const id = base62.encode(num);

  let campaign;

  try {
    campaign = await Campaign.findOne({id: id});
  } catch (err) {
    log.warn("Database error finding campaign ", err);
    throw err;
  }

  if (campaign) {
    return getCampaignId();
  }

  return id;
}

module.exports = {
  referFriend
}