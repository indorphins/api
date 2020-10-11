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

  let weekGroup = {
    $group: {
      _id: {
        year: "$_id.year",
        week: "$_id.week",
      },
      data: {
        $push: {
          type: "$_id.type",
          total: "$total",
        }
      }
    }
  }

  let flattened = {
    $project: {
      user: {
        $function: {
          body: `function(data) {
            let updated = {};
            for (var i = 0; i < data.length; i++) {
              let current = data[i];
              updated[current.type] = current.total
            }

            return updated;
          }`,
          args: ["$data"],
          lang: "js"
        }
      }
    }
  }

  let report = {
    $project: {
      week: "$_id.week",
      year: "$_id.year",
      user: "$user",
    }
  }

  let save = {
    $merge: {
      into: "reportings",
      on: "_id",
      whenMatched: "merge",
      whenNotMatched: "insert",
    }
  }

  return User.aggregate([
    formatted,
    group,
    weekGroup,
    flattened,
    report,
    save
  ])
}

module.exports = {
  newUsers: newUsers
}