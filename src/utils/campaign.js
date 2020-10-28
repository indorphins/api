const Campaign = require('../db/Campaign');
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
function isValidCampaignForUser(campaignId, userData) {
  let existingCampaign = false;
  let discountAppliedErr;
  let discountApplied;
  let campaign;

  try {
    campaign = await Campaign.findOne({id: campaignId});
  } catch (err) {
    log.warn("Database error on campaign lookup for transaction checkout ", err);
    discountAppliedErr = "Sorry, there was an error applying your promo code.";
  }

  if (!campaign) {
    log.warn("No campaign found by ID ", id);
    discountAppliedErr = "Sorry, that promo doesn't exist.";
  } else {
    if (campaign.expires) {
      const now = new Date();
      const expiry = new Date(campaign.expires);
      if (isBefore(expiry, now)) {
        log.warn("Campaign expired ", id);
        discountAppliedErr = "Sorry, this deal isn't going on anymore."
      }
    }

    if (!campaign.active) {
      log.warn("Campaign inactive ", id);
      discountAppliedErr = "Sorry, this deal isn't valid anymore.";
    }

    let remaining = campaign.discountMultiplier - 1;

    // If the user has already exhausted this code, don't apply discount
    if (userData.campaigns) {
      // iterate over each campaign object and check for a match
      userData.campaigns.forEach(c => {
        if (c.campaignId === campaignId) {
          if (c.remaining <= 0) {
            discountAppliedErr = "Sorry, you've already used up this sweet deal.";
          } else {
            remaining = c.remaining - 1
            existingCampaign = true;
          }
        }
      })

      if (campaign.newUser && !existingCampaign) {
        let transactions;
  
        try {
          transactions = await Transaction.find({ userId: userData.id });
        } catch (err) {
          log.warn("Database error fetching transactions for campaign newUser check ", err);
          discountAppliedErr = "Sorry, there was an error applying your promo code.";
        }
  
        if (transactions && transactions.length > 0) {
          discountAppliedErr = "Sorry, this discount is only available to new users.";
        }
      }
   
  
      if (campaign.discountMultiplier < 0) {
        discountAppliedErr = "Sorry, this promotion doesn't work.";
      }

      if (!discountAppliedErr) {
        discountApplied = getCampaignSuccessMessage(userData, campaign);
      }
    }
  }

  return {
    campaign: campaign,
    valid: discountAppliedErr ? false : true,
    msg: discountAppliedErr ? discountAppliedErr : discountApplied,
    existingCampaign: existingCampaign
  }
};

/**
 * Updates the user's data to establish they just used a campaign code
 * This either adds the campaign or updates an existing to have one less "remaining" uses of the campaign code
 * If isReferrer is true, it does the logic to add discounts to the referrer's campaign 
 * in the event that someone else used their code and they're now eligible to receive referral benefits
 * 
 * Returns the updated userData to be used for a db update 
 * @param {Object} userData 
 * @param {Object} campaign 
 * @param {Boolean} isReferrer 
 * @returns {Object} 
 */
function updateUserCampaigns(userData, campaign, isReferrer) {
  let updated = false;

  if (userData && userData.campaigns) {
    userData.campaigns.forEach(c => {
      if (c.campaignId === campaign.id) {
        // If updating the referrer, add the referrer multiplier otherwise decrement remaining classes by 1
        c.remaining += isReferrer ? campaign.referrerDiscountMultiplier : -1;
        updated = true;
      }
    })
  }

  if (!updated) {
    const newCampaign = {
      campaignId: campaign.id,
      remaining: isReferrer ? campaign.referrerDiscountMultiplier : campaign.discountMultiplier - 1
    }
    if (userData.campaigns) {
      userData.campaigns.push(newCampaign)
    } else {
      userData.campaigns = [newCampaign];
    }
  }

  return userData;
}

function getCampaignSuccessMessage(userData, campaign) {
  const isReferrer = userData.id === campaign.referrerId;
  let message;

  if (isReferrer) {
    if (campaign.referrerDiscountAmount) {
      message = `$${campaign.referrerDiscountAmount} off!`;
      if (remaining > 0) {
        message += ` And $${campaign.referrerDiscountAmount} off your next ${remaining > 1 ? `${remaining} classes` : 'class'}!`;
      }
    } else if (campaign.referrerDiscountRate) {
      message = `${campaign.referrerDiscountRate}% off!`;
      if (remaining > 0) {
        message += ` And ${campaign.referrerDiscountRate}% off your next ${remaining > 1 ? `${remaining} classes` : 'class'}!`;
      }
    }
  } else {
    if (campaign.discountAmount) {
      message = `$${campaign.discountAmount} off!`;
      if (remaining > 0) {
        message += ` And $${campaign.discountAmount} off your next ${remaining > 1 ? `${remaining} classes` : 'class'}!`;
      }
    } else if (campaign.discountRate) {
      message = `${campaign.discountRate}% off!`;
      if (remaining > 0) {
        message += ` And ${campaign.discountRate}% off your next ${remaining > 1 ? `${remaining} classes` : 'class'}!`;
      }
    }
  } 
  return message;
}

module.exports = {
  isValidCampaignForUser,
  updateUserCampaigns
}