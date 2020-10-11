const Session = require('../src/db/Session');

async function classAttendence() {

  let formatData = {
    $project: {
      users: "$users_joined",
      year: { $year: "$start_date"},
      week: { $week: "$start_date" },
    } 
  };

  let unwind = {
    $unwind: "$users"
  }

  let group = {
    $group: {
      _id: {
        year: "$year",
        week: "$week",
      },
      total: {
        $push: "$users",
      },
      unique: {
        $addToSet: "$users",
      }
    }
  }

  let report = {
    $project: {
      week: "$_id.week",
      year: "$_id.year",
      totalAttended: {
        $size: "$total",
      },
      uniqueAttended: {
        $size: "$unique",
      }
    }
  }

  return Session.aggregate([
    formatData,
    unwind,
    group,
    report,
  ])
}

async function returnRate() {

  let formatData = {
    $project: {
      instructor: "$instructor_id",
      session: "$session_id",
      joined: {
        $filter: {
          input: "$users_joined",
          as: "user",
          cond: {
            $not: [ { $eq: ["$instructor_id", "$$user"]}]
          }
        }
      },
      noShow: {
        $setDifference: ["$users_enrolled", "$users_joined"],
      },
      year: { $year: "$start_date"},
      week: { $week: "$start_date" },
    } 
  };


  let uwind = {
    $unwind: {
      path: "$joined",
      preserveNullAndEmptyArrays: false,
    }
  };

  let weekGroup = {
    $group: {
      _id: {
        week: "$week",
        year: "$year",
        instructor: "$instructor",
      },
      joined: {
        $addToSet: "$joined"
      }, 
      noShow: {
        $sum: {
          $size: "$noShow"
        }
      }
    }
  }

  let weekSort = {
    $sort: {
      "_id.instructor": -1,
      "_id.year": 1,
      "_id.week": 1,
    }
  }

  let insGroup = {
    $group: {
      _id: "$_id.instructor",
      weeks: {
        $push: {
          instructor: "$_id.instructor",
          week: "$_id.week",
          year: "$_id.year",
          joined: "$joined",
          noShow: "$noShow",
        }
      }
    }
  }

  let returningUsers = {
    $project: {
      weeks: {
        $function: {
          body: `function(weeks) {
            let updated = [];
            for (var i = 0; i < weeks.length; i++) {
              let current = weeks[i];
              let prev = weeks[i-1];

              if (prev) {
                let a = current.joined;
                let b = prev.joined;

                let missing = b.filter((item) => a.indexOf(item) < 0);
                let p = (b.length - missing.length) / b.length;
                current.percentageReturned = p;
              } else {
                current.percentageReturned = 0;
              }

              updated.push(current);
            }

            return updated;
          }`,
          args: ["$weeks"],
          lang: "js"
        }
      }
    }
  }

  let weekUnwind = {
    $unwind: {
      path: "$weeks",
      preserveNullAndEmptyArrays: false,
    }
  }

  let flat = {
    $project: {
      instructorId: "$weeks.instructor",
      week: "$weeks.week",
      year: "$weeks.year",
      uniqueAttended: {
        $size: "$weeks.joined",
      },
      totalNoShows: "$weeks.noShow",
      percentageReturned: "$weeks.percentageReturned",
    }
  }

  return Session.aggregate([
    formatData,
    uwind,
    weekGroup,
    weekSort,
    insGroup,
    returningUsers,
    weekUnwind,
    flat,
  ]);
}

module.exports = {
  returnRate: returnRate,
  classAttendence: classAttendence,
}