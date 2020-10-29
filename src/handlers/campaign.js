const Campaign = require('../db/Campaign');
const base62 = require("base62/lib/ascii");
const log = require('../log');
const isBefore = require('date-fns/isBefore')

// Creates a refer a friend campaign, overwriting any that may exist already for the user
async function referFriend(req, res) {
  const userData = req.ctx.userData;

  let campaign;

  try {
    campaign = await Campaign.findOne({referrerId: userData.id});
  } catch (err) {
    log.warn("Database error finding campaign ", err);
  }

  if (!campaign) {

    let num = Math.floor(Math.random() * 1e13);
    let id = base62.encode(num);

    let exists = await Campaign.findOne({id: id});

    while (exists) {
      num = Math.floor(Math.random() * 1e13);
      id = base62.encode(num);
      exists = await Campaign.findOne({id: id});
    }

    const newCampaign = {
      id: id,
      referrerId: userData.id,
      discountAmount: 500,
      discountMultiplier: 4,
      referrerDiscountAmount: 1000,
      referrerDiscountMultiplier: 1,
      newUser: true,
      description: `thanks to ${userData.username}`,
      active: true,
      date: new Date().toISOString(),
    };
    
    try {
      campaign = await Campaign.create(newCampaign);
    } catch (err) {
      log.warn("Database error creating campaign ", err);
      return res.status(500).json({
        message: "Database error creating campaign"
      });
    }

  }

  log.debug("campaign data", campaign);
  res.status(200).json(campaign);
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