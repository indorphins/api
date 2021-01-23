const getSubscriptionCostOverDays = require('./subscription').getSubscriptionCostOverDays;
const Subscription = require('../../db/Subscription');
const Class = require('../../db/Class');
const User = require('../../db/User');
const log = require('../../log');

// Gets a map of each instructors share of subscription money between startDate and endDate
// BASED ON ASSUMPTION THAT NO SPOTS WERE BOOKED WITH A "BOOKED ONCE" FLOW
// Booked once flow would go directly to the instructors anyway
async function getInstructorsSubShare(req, res) {
  const startDate = req.params.start_date;
  const endDate = req.params.end_date;
  const userData = req.ctx.userData;

  if (userData.type !== 'admin') {
    res.status(403).json({
      message: "Account type forbidden"
    })
  }

  // get all subs that include days between start and end date
  const start = new Date(startDate);
  const end = new Date(endDate);

  let filter = {
    $and: [
      {
        status: 'ACTIVE'
      },
      {
        $or: [
          {
            $and: [
              { period_start: { $lte: start.toISOString() } },
              { period_end: { $gte: start.toISOString() } },
            ],
            $and: [
              { period_start: { $gte: start.toISOString() } },
              { period_start: { $lte: end.toISOString() } }
            ]
          }
        ]
      },
    ]
  };
  let subs = [];

  try {
    subs = await Subscription.find(filter);
  } catch (err) {
    log.warn("Database error ", err);
    return res.status(500).json({
      message: 'Database error'
    })
  }

  let totalPot = 0;
  if (subs && subs.length > 0) {
    // Maybe could use a reducer here
    subs.forEach(sub => {
      let c = getSubscriptionCostOverDays(sub, start, end);
      totalPot += c;
    })
  }

  // Find the total funds pool based on each subscription 
  // Then get all the classes taught between start and end date
  // Then get the number of spots filled by each instructor in the time range
  
  let classes;
  filter = {
    $and: [
      { start_date: { $gte: start } },
      { start_date: { $lte: end } }
    ]
  }

  try {
    classes = await Class.find(filter)
  } catch (err) {
    log.warn("Database error ", err);
    return res.status(500).json({
      message: 'Database error'
    })
  }

  if (!classes || classes.length === 0) {
    log.warn("No classes ran during input period")
    return res.status(404).json({
      message: "No classes ran during input period"
    })
  }

  let spotsBooked = {};
  let totalSpotsBooked = 0;

  classes.forEach(c => {
    if (!spotsBooked[c.instructor]) {
      spotsBooked[c.instructor] = c.subscription_users ? c.subscription_users : 0;
    } else {
      spotsBooked[c.instructor] += c.subscription_users ? c.subscription_users : 0;
    }
    totalSpotsBooked += c.subscription_users ? c.subscription_users : 0;
  })

  // Fetch all instructors
  let instructors;

  try {
    instructors = await User.find({ type: 'instructor' })
  } catch (err) {
    log.warn("Database error ", err);
    return res.status(500).json({
      message: 'Database error'
    })
  }

  if (!instructors || instructors.length === 0) {
    log.warn("No instructors found in db - we keep all the money!");
    return res.status(500).json({
      message: 'No instructors found in db'
    })
  }

  // Instructors get a share equal to the number of spots booked in classes hosted between start and end date 
  // DIVIDED BY the total number of spots booked in all classes over that time (set to 1 if 0 to avoid NaN)
  // TIMES the amount of subscription money generated during that time allotted for instructors (80%)

  if (totalSpotsBooked === 0) {
    totalSpotsBooked = 1;
  }

  let payouts = instructors.map(i => {
    let booked = spotsBooked[i.id] ? spotsBooked[i.id] : 0;
    let payout = booked / totalSpotsBooked * totalPot * .8 / 100;
    return {
      name: i.username,
      id: i.id,
      payout: payout.toFixed(2),
      startDate: start,
      endDate: end
    }
  });

  log.info("Fetched instructor payouts");
  log.debug("payout data ", payouts);
  return res.status(200).json(payouts);
}

async function payoutInstructor(instructorId) {

  // Use Stripe api to make direct payment from our company stripe account
  // to the instuctor's connected account for their share

}

module.exports = {
  getInstructorsSubShare
}