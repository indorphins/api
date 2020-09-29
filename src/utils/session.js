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
  let items = Array.from(new Set(getClassWeeks(sessions)));
  let last = items[0];
  let index = 0;
  let streak = 0;
  let current = getWeek(new Date());

  if (current === last || current - 1 === last || last - current === 51) {
    streak = 1;
    index = 1;
  }

  while(
    items[index] && 
    (last - items[index] === 1 || items[index] - last === 51)
  ) {

    streak = streak + 1;
    last = items[index];
    index = index + 1;
  }

  return streak;
}

module.exports = {
  getRecentStreak,
}