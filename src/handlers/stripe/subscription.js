const StripeUser = require('../../db/StripeUser');
const Class = require('../../db/Class');
const Transaction = require('../../db/Transaction');
const Subscription = require('../../db/Subscription');
const User = require('../../db/User');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const log = require('../../log');
const utils = require('../../utils/index');

async function createSubscription(req, res) {

  // fetch the stripe user and 
  // fetch the product sku corresponding to the sub they selected 
  // create a stripe subscription based on the sub the user selected to sign up for
  // Create our own subscription object in our db

}

async function getInstructorsSubShare(instructorId, startDate, endDate) {

  // Instructors get a share equal to the number of spots booked in classes hosted between start and end date 
  // DIVIDED BY the total number of spots booked in all classes over that time
  // TIMES the amount of subscription money generated during that time allotted for instructors (80%)

}

async function payoutInstructor(instructorId) {

  // Use Stripe api to make direct payment from our company stripe account
  // to the instuctor's connected account for their share

}

async function cancelSubscription(req, res) {

  // must cancel the user's subscription and remove them from all booked classes (under the sub)
  // refund user based on classes not taken / total classes in subscription * sub cost
  
}

async function subscriptionWebhook(req, res) {

  // Handle setting subscription status based on invoices paid/failed - see current webhook for stripe

}