const getDayOfYear = require('date-fns/getDayOfYear');
const differenceInWeeks = require('date-fns/differenceInWeeks');

/**
 * If the nextClass will hit a new weekly streak benchmark return the benchmark
 * Else return 0
 * @param {Array} sessions 
 * @param {Object} nextClass 
 */
function getRecentStreak(sessions, nextClass) {
  if (sessions.length < 2) {
    return 0;
  }

  let longest = 0;
  let start = new Date(nextClass.start_date);
  let last = new Date(nextClass.start_date);

  sessions.forEach(session => {
    let sessionDate = new Date(session.start_date);

    if (getDayOfYear(last) !== getDayOfYear(sessionDate)) {
      let weekDiff = differenceInWeeks(last, sessionDate)
      if (weekDiff > 1) {
        return longest;
      } else {
        weekDiff = differenceInWeeks(start, sessionDate);
        if (weekDiff > longest) {
          longest = weekDiff;
        }
      }
      last = sessionDate;
    }
  })

  let weeklyStreakLabels = [2, 3, 4, 7, 10, 20, 30, 40, 52, 60, 70, 80, 90, 104, 125, 156, 175, 208];

  if (weeklyStreakLabels.indexOf(longest) > -1) {
    return longest;
  }

  return 0;
}

/**
 * If the user has taken X + 1 classes that match one of the benchmarks, return the benchmark
 * X + 1 because of the classes they've taken plus the one they are signed up for but haven't joined yet
 * Else returns 0
 * @param {Array} sessions 
 */
function getClassesTaken(sessions) {
  let classesTakenLabels = 
  [1, 5, 10, 20, 30, 50, 75, 100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000];

  if (Array.isArray(sessions) && classesTakenLabels.indexOf(sessions.length + 1) > -1) {
    return sessions.length + 1;
  }

  return 0;
}

module.exports = {
  getClassesTaken,
  getRecentStreak,
}