const Campaign = require('../db/Campaign');
const base62 = require("base62/lib/ascii");
const log = require('../log');

// Creates a refer a friend campaign, overwriting any that may exist already for the user
async function referFriend(req, res) {
  const userData = req.ctx.userData;

  let campaign;

  try {
    campaign = await Campaign.findOne({referrerId: userData.id});
  } catch (err) {
    log.warn("Database error finding campaign ", err);
    throw err;
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
      active: true,
      date: new Date().toISOString(),
    };
    
    try {
      campaign = await Campaign.create(newCampaign);
    } catch (err) {
      log.warn("Database error creating campaign ", err);
      res.status(500).json({
        message: "Database error creating campaign"
      });
    }

  }

  log.debug("campaign data", campaign);
  res.status(200).json(campaign);
}

module.exports = {
  referFriend
}