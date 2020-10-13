const User = require('../src/db/User');

async function newUsers() {
  let formatted = { 
    $project: {
      userId: "$userId",
      year: { $isoWeekYear: "$created_date"},
      week: { $isoWeek: "$created_date" },
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
      newUserTotals: "$user",
    }
  }

  let flat = {
    $project: {
      week: "$week",
      year: "$year",
      newUsers: {
        $cond: { $ne: ["$newUserTotals.standard", undefined]},
        then: "$newUserTotals.standard",
        else: 0,
      },
      newInstructors: {
        $cond: { $ne: ["$newUserTotals.instructor", undefined]},
        then: "$newUserTotals.instructor",
        else: 0,
      },
      newAdmins: {
        $cond: { $ne: ["$newUserTotals.admin", undefined]},
        then: "$newUserTotals.admin",
        else: 0,
      }
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