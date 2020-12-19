

async function getInstructorsSubShare(instructorId, startDate, endDate) {

  // Instructors get a share equal to the number of spots booked in classes hosted between start and end date 
  // DIVIDED BY the total number of spots booked in all classes over that time
  // TIMES the amount of subscription money generated during that time allotted for instructors (80%)

}

async function payoutInstructor(instructorId) {

  // Use Stripe api to make direct payment from our company stripe account
  // to the instuctor's connected account for their share

}