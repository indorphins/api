const User = require('../db/User');
const Transaction = require('../db/Transaction');
const log = require('../log');
const isBefore = require('date-fns/isBefore');

/**
 * Checks if the campaignId is a valid campaign for the given userData
 * Check if campaign ID is here, lookup and fetch
 * Validate it's active, not expired and if newUser that this user doesn't have any transactions
 * Check their existing campaigns, if they've used it make sure count is valid
 * @param {String} campaignId
 * @param {Object} userData 
 * @returns {Object} campaign: object, the campaign; valid: boolean; msg: error/success message string (empty if valid);
 *                   existingCampaign: boolean, if campaign is already in user's list of campaigns
 */
async function isValidCampaignForUser(campaign, userData, price) {
  const isReferrer = userData.id === campaign.referrerId;
  let existing = userData.campaigns.find(c => c.campaignId === campaign.id);
  log.debug("Existing user campaign data", existing);
  let data = {};

  if (!campaign.active) {
    log.warn("Campaign inactive ", id);
    data.msg = "Sorry, this deal is no longer active.";
    return data;
  }

  if (campaign.expires) {
    const now = new Date();
    const expiry = new Date(campaign.expires);
    if (isBefore(expiry, now)) {
      log.warn("Campaign expired ", id);
      data.msg = "Sorry, this deal is no longer active."
      return data;
    }
  }

  if (existing && existing.remaining <= 0) {
    data.msg = "Sorry, you've already used this bangin' deal."
    return data;
  }

  if (isReferrer && !existing) {
    data.msg = "Sorry, you need a friend to signup and book a class before you can use this discount."
    return data;
  }

  if (campaign.newUser && !isReferrer && !existing) {
    let transactions;

    try {
      transactions = await Transaction.find({ userId: userData.id });
    } catch (err) {
      log.warn("Database error fetching transactions for campaign newUser check ", err);
      data.msg = "Sorry, there was an error applying your discount code.";
      return data;
    }

    if (transactions && transactions.length > 0) {
      data.msg = "Sorry, this discount is only available to new users.";
      return data;
    }
  }
  
  let discountRate;
  let discountAmount;
  let discountText;
  let multiplier;

  if (isReferrer) {
    if (campaign.referrerDiscountRate) discountRate = campaign.referrerDiscountRate;
    if (campaign.referrerDiscountAmount) discountAmount = campaign.referrerDiscountAmount;
    multiplier = campaign.referrerDiscountMultiplier - 1;
  } else {
    if (campaign.discountRate) discountRate = campaign.discountRate;
    if (campaign.discountAmount) discountAmount = campaign.discountAmount;
    multiplier = campaign.discountMultiplier - 1;
  }

  if (discountRate) {
    price = Math.floor(price * (1 - discountRate));
    discountText = (discountRate*100) + "%";
  } 

  if (discountAmount) {
    price = price - discountAmount;
    discountText = "$" + (discountAmount / 100);
  }

  data.msg = `${discountText} off!`;

  if (existing && existing.remaining) {
    multiplier = existing.remaining - 1;
  }

  data.msg = `${discountText} off!`;
  if (multiplier) {
    if (multiplier > 1) {
      data.msg = data.msg + ` And ${discountText} off your next ${multiplier} classes.`;
    } 
    
    if (multiplier === 1) {
      data.msg = data.msg + ` And ${discountText} off your next class.`;
    }
  }

  if (existing) {
    data.saved = true;
  } else {
    data.saved = false;
  }

  data.remaining = multiplier;
  data.price = price;
  return data;
};

/**
 * Updates the user's data to establish they just used a campaign code
 * 
 * @param {Object} userData 
 * @param {Object} campaign 
 * @param {Object} campaignInfo 
 */
async function updateUserCampaigns(userData, campaign, campaignInfo) {
  if (!campaignInfo || (!campaignInfo.price && campaignInfo.price !== 0)) return;

  let match = userData.campaigns.find((item) => item.campaignId === campaign.id);
  
  if (match) {
    match.remaining = campaignInfo.remaining;
  } else {
    let data = {
      campaignId: campaign.id,
      remaining: campaignInfo.remaining,
    }

    if (userData.campaigns) {
      userData.campaigns.push(data);
    } else {
      userData.campaigns = [data];
    }
  }

  log.debug("Saving user campaign rewards", userData);

  try {
    await User.update({ id: userData.id }, userData);
  } catch (err) {
    // don't return here in case the referrer gets a discount we want to try and process that
    log.warn("Database error updating user post-campaign application ", err);
  }

  // Fetch and update the referrer's user data if they get a discount and the booking user is using a campaign they have not before
  if (
    !campaignInfo.saved && 
    userData.id !== campaign.referrerId &&
    (campaign.referrerDiscountRate || campaign.referrerDiscountAmount)
  ) {
    let referrer;

    try {
      referrer = await User.findOne({ id: campaign.referrerId });
    } catch(err) {
      return log.warn("Database error finding campaign referrer user ", err);
    }

    if (referrer) {
      let match = referrer.campaigns.find((item) => item.campaignId === campaign.id);

      if (match) {
        match.remaining = match.remaining + campaign.referrerDiscountMultiplier;
      } else {
        let data = {
          campaignId: campaign.id,
          remaining: campaign.referrerDiscountMultiplier,
        }
    
        if (referrer.campaigns) {
          referrer.campaigns.push(data);
        } else {
          referrer.campaigns = [data];
        }
      }

      log.debug("Saving referrer campaign rewards", referrer);
      try {
        await User.update({ id: referrer.id }, referrer);
      } catch (err) {
        return log.warn("Database error updating referrer post-campaign application ", err);
      }
    }
  }
}

module.exports = {
  isValidCampaignForUser,
  updateUserCampaigns
}