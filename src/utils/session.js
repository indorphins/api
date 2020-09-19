const getISOWeek = require('date-fns/getISOWeek');
const getYear = require('date-fns/getYear');

function getWeek(d) {
  return getISOWeek(d) + getYear(d);
}

function getClassWeeks(sessions) {
  return sessions.map(item => {
    let d = new Date(item.start_date);
    return getWeek(d);
  });
}

/**
 * If the nextClass will hit a new weekly streak benchmark return the benchmark
 * Else return 0
 * @param {Array} sessions 
 * @param {Object} nextClass 
 */
function getRecentStreak(sessions) {
  let items = getClassWeeks(sessions);
  let last = items[0];
  let index = 0;
  let streak = 0;
  let current = getWeek(new Date());

  if (current === last) {
    streak = 1;
    index = 1;
    while(
          items[index] && 
          (last - items[index] === 1 || last - items[index] === 0 || items[index] - last === 51)
        ) {
      
      if (last - items[index] === 1) {
        streak = streak + 1;
      }

      last = items[index];
      index = index + 1;
    }
  }

  return streak;
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