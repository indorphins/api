const Campaign = require('../db/Campaign');
const base62 = require("base62/lib/ascii");
const log = require('../log');
const isBefore = require('date-fns/isBefore')

// Creates a refer a friend campaign, overwriting any that may exist already for the user
async function referFriend(req, res) {
  const userData = req.ctx.userData;

  let campaign;

  try {
    campaign = await getCampaignId(userData.id);
  } catch (err) {
    log.warn("Database error creating campaign id ", err);
    return res.status(500).json({
      message: "Database error creating campaign id"
    })
  }

  if (!campaign) {

    const num = Math.floor(Math.random() * 1e13);
    const id = base62.encode(num);

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
    
    try {
      campaign = await Campaign.findOneAndUpdate({referrerId : newCampaign.referrerId}, newCampaign, {upsert: true});
    } catch (err) {
      log.warn("Database error creating campaign ", err);
      return res.status(500).json({
        message: "Database error creating campaign"
      });
    }
  }

  res.status(200).json(campaign);
}

// Create a new random campaign id by base62 encoding a randomly large number
// Checks if the campaign exists with new id, recursively calls itself to create a new one
async function getCampaignId(id) {

  let campaign;

  try {
    campaign = await Campaign.findOne({referrerId: id});
  } catch (err) {
    log.warn("Database error finding campaign ", err);
    throw err;
  }

  return campaign;
}

async function get(req, res) {
  const id = req.params.id;

  let campaign;

  try {
    campaign = await Campaign.findOne({id: id});
  } catch (err) {
    log.warn("Database error fetching campaign by id ", err);
    return res.status(500).json({
      message: "Database error"
    })
  }

  if (!campaign) {
    log.warn("No campaign found by ID ", id);
    return res.status(404).json({
      message: "Campaign not found"
    })
  }

  if (campaign.expires) {
    const now = new Date();
    const expiry = new Date(campaign.expires);
    if (isBefore(expiry, now)) {
      log.warn("Campaign expired ", id);
      return res.status(410).json({
        message: 'Campaign expired'
      })
    }
  }

  if (!campaign.active) {
    log.warn("Campaign inactive ", id);
    return res.status(410).json({
      message: 'Campaign inactive'
    })
  }

  res.status(200).json(campaign);
}

module.exports = {
  referFriend,
  get
}