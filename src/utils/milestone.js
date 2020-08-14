function getNewMilestone(id) {
  return {
    user_id: id,
    lives_changed: [],
    days_changed: {
      count: 0,
      users: [],
      day: null
    },
    classes_taught: 0,
    dollars_earned: 0,
    weeks_taught: 0,
    users_referred: 0,
    instructors_referred: 0,
    classes_taken: 0,
    weekly_streak: {
      start: null,
      last_class: null,
      max_count: 0
    },
    instructors_taken: {},
    nurture_classes: 0
  };
};

/**
 * Updates instructor milestones after a course is taught by them
 * @param {Object} iStone instructor's milestone object
 * @param {Array} participants list of IDs of who was in session
 * @param {Object} course 
 */
function updateInstructorMilestones(iStone, participants, course) {
  participants.forEach(id => {
  
    if (!iStone.days_changed.day) {
      iStone.days_changed.day = course.start_date;
    }

    // Check that its not checking for time only day
    if (iStone.days_changed.day !== course.start_date) {
      // push the previous day's user list to the count and start fresh
      iStone.days_changed.count += iStone.days_changed.users.length;
      iStone.days_changed.users = [];
      iStone.days_changed.day = course.start_date
    }

    if (!iStone.days_changed.users.includes(id)) {
      iStone.days_changed.users.push(id);
      iStone.days_changed.count++;
    }

    if (!iStone.lives_changed.includes(id)) {
      iStone.lives_changes.push(id);
    }

    iStone.classes_taught++;

    if (!iStone.weeks_taught.start) {
      iStone.weeks_taught.start = course.start_date;
      iStone.weeks_taught.last_class = course.start_date;
      iStone.weeks_taught.max_count = 0;
    }

    // Checking date not time
    if (iStone.weeks_taught.last_class !== course.start_date) {
      let weeksDiff;
      // get diff b/w last class and this one in weeks
      if (weeksDiff > 0) {
        // reset weeks taught
        iStone.weeks_taught.start = course.start_date
      } else {
        // get diff b/w this course and start in weeks
        weeksDiff = 1;
        if (weeksDiff > iStone.weeks_taught.max_count) {
          iStone.weeks_taught.max_count = weeksDiff;
        }
      }
    }
  })

  return iStone;
}

/**
 * Updates the user's milestones after they take a course
 * @param {Object} pStone
 */
function updateParticipantMilestones(pStone, course) {
  pStone.classes_taken++;

  if (!pStone.weekly_streak.start) {
    pStone.weekly_streak.start = course.start_date;
  }
  
  // Weekly streak logic
  // check this by day not datetime
  if (pStone.weekly_streak.day !== course.start_date) {
    let weekDiff; // course.start_date - pStone.weekly_streak.start
    if (weekDiff > 0) {
      pStone.weekly_streak.start = course.start_date;
    } else {
      weekDiff = 1; // course.start_date - pStone.weekly_streak.last_class
      if (weekDiff > pStone.weekly_streak.max_count) {
        pStone.weekly_streak.max_count = weekDiff;
      }
    }
  }

  // Setup or add to classes taken from the instructor
  if (!pStone.instructors_taken[course.instructor]) {
    pStone.instructors_taken[course.instructor] = 1
  } else {
    pStone.instructors_taken[course.instructor]++;
  }

  if (pStone.nuture_classes < 3) {
    pStone.nuture_classes++;
  }

  return pStone;
}

module.exports = {
  getNewMilestone,
  updateInstructorMilestones,
  updateParticipantMilestones
}