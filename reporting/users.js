const User = require('../src/db/User');

async function newUsers() {
  let formatted = { 
    $project: {
      userId: "$userId",
      year: { $year: "$created_date"},
      week: { $week: "$created_date" },
      type: "$type",
    }
  };

  let group = {
    $group: {
      _id: {
        year: "$year",
        week: "$week",
        type: "$type",
      },
      total: {
        $sum: 1
      }
    }
  }

  let report = {
    $project: {
      week: "$_id.week",
      year: "$_id.year",
      type: "$_id.type",
      total: "$total",
    }
  }

  return User.aggregate([
    formatted,
    group,
    report
  ])
}

module.exports = {
  newUsers: newUsers
}