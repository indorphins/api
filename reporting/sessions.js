const Session = require('../src/db/Session');

async function newParticipants() {
  let format = {
    $project: {
      users: {
        $filter: {
          input: "$users_joined",
          as: "user",
          cond: {
            $not: [ { $eq: ["$instructor_id", "$$user"]}]
          }
        }
      },
      instructorId: "$instructor_id",
      year: { $year: "$start_date"},
      week: { $week: "$start_date" },
    } 
  };

  let unwind = {
    $unwind: "$users"
  };

  let group = {
    $group: {
      _id: {
        userId: "$users"
      },
      sessions: {
        $push: {
          week: "$week",
          year: "$year",
          instructorId: "$instructorId",
        }
      },
    }
  }

  let sessions = {
    $unwind: "$sessions",
  }

  let count = {
    $group: {
      _id: {
        week: "$sessions.week",
        year: "$sessions.year",
        userId: "$_id.userId",
      },
      instructors: {
        $addToSet: "$sessions.instructorId",
      },
      count: {
        $sum: 1,
      }
    }
  }

  let sortByDate = {
    $sort: {
      "_id.year": 1,
      "_id.week": 1,
      "_id.userId": 1,
    }
  }

  let userGroup = {
    $group: {
      _id: "$_id.userId",
      data: {
        $push: {
          week: "$_id.week",
          year: "$_id.year",
          count: "$count",
          instructors: "$instructors",
        }
      },
    }
  }

  let allTimeAttended = {
    $project: {
      data: {
        $function: {
          body: `function(data) {
            let updated = [];
            let sum = 0;
            for (var i = 0; i < data.length; i++) {
              let current = data[i];
              current.prevAllTime = sum;
              current.allTime = sum + current.count;
              updated.push(current);
              sum = sum + current.count;
            }

            return updated;
          }`,
          args: ["$data"],
          lang: "js"
        }
      }
    }
  }

  let flat = {
    $unwind: "$data",
  }

  let insFlat = {
    $unwind: {
      path: "$data.instructors",
      preserveNullAndEmptyArrays: true,
    }
  }

  let isNew = {
    $set: {
      isNew: {
        $cond: {
          if: { $gt: ["$data.prevAllTime", 0]},
          then: false,
          else: true,
        }
      }
    }
  }

  let countNew = {
    $group: {
      _id: {
        year: "$data.year",
        week: "$data.week",
        instructorId: "$data.instructors",
        isNew: "$isNew",
      },
      totalUsers: {
        $push: "$_id",
      },
      uniqueUsers: {
        $addToSet: "$_id",
      },
    }
  }

  let size = {
    $project: {
      totalUsers: {
        $size: "$totalUsers",
      },
      uniqueUsers: {
        $size: "$uniqueUsers",
      }
    }
  }

  let instructorGroup = {
    $group: {
      _id: {
        year: "$_id.year",
        week: "$_id.week",
        instructorId: "$_id.instructorId",
      },
      data: {
        $push: {
          isNew: "$_id.isNew",
          totalUsers: "$totalUsers",
          uniqueUsers: "$uniqueUsers",
        }
      }
    }
  }

  let filter = {
    $project: {
      new: {
        $first: {
          $filter: {
            input: "$data",
            as: "d",
            cond: {
              $eq: ["$$d.isNew", true],
            }
          }
        }
      },
      existing: {
        $first: {
          $filter: {
            input: "$data",
            as: "d",
            cond: {
              $eq: ["$$d.isNew", false],
            }
          }
        }
      }
    }
  }

  let report = {
    $project: {
      totalNewUser: {
        $cond: {
          if: { $gt: ["$new.totalUsers", null] },
          then: "$new.totalUsers",
          else: 0,
        }
      },
      uniqueNewUser: {
        $cond: {
          if: { $gt: ["$new.uniqueUsers", null] },
          then: "$new.uniqueUsers",
          else: 0,
        }
      },
      totalExistingUser: {
        $cond: {
          if: { $gt: ["$existing.totalUsers", null] },
          then: "$existing.totalUsers",
          else: 0,
        }
      },
      uniqueExistingUser: {
        $cond: {
          if: { $gt: ["$existing.uniqueUsers", null] },
          then: "$existing.uniqueUsers",
          else: 0,
        }
      }
    }
  }

  let save = {
    $merge: {
      into: "instructorreportings",
      on: "_id",
      whenMatched: "merge",
      whenNotMatched: "insert",
    }
  }

  return Session.aggregate([
    format,
    unwind,
    group,
    sessions,
    count,
    sortByDate,
    userGroup,
    allTimeAttended,
    flat,
    insFlat,
    isNew,
    countNew,
    size,
    instructorGroup,
    filter,
    report,
    save,
  ])
}

async function classAttendence() {

  let format = {
    $project: {
      users: {
        $filter: {
          input: "$users_joined",
          as: "user",
          cond: {
            $not: [ { $eq: ["$instructor_id", "$$user"]}]
          }
        }
      },
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

  let save = {
    $merge: {
      into: "reportings",
      on: "_id",
      whenMatched: "merge",
      whenNotMatched: "insert",
    }
  }

  return Session.aggregate([
    format,
    unwind,
    group,
    report,
    save,
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
      _id: {
        year: "$weeks.year",
        week: "$weeks.week",
        instructorId: "$weeks.instructor",
      },
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

  let save = {
    $merge: {
      into: "instructorreportings",
      on: "_id",
      whenMatched: "merge",
      whenNotMatched: "insert",
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
    save,
  ]);
}

async function participantAvg() {

  let formatData = {
    $project: {
      instructor: "$instructor_id",
      session: "$session_id",
      joined: {
        $size: {
          $filter: {
            input: "$users_joined",
            as: "user",
            cond: {
              $not: [ { $eq: ["$instructor_id", "$$user"]}]
            }
          }
        }
      },
      year: { $year: "$start_date"},
      week: { $week: "$start_date" },
    } 
  };

  let group = {
    $group: {
      _id: {
        year: "$year",
        week: "$week",
        instructorId: "$instructor",
      },
      classes: {
        $sum: 1,
      },
      totalAttended: {
        $sum: "$joined",
      },
      avgJoined: {
        $avg: "$joined",
      }
    }
  }

  let instructorLookup = {
    $lookup: {
      from: "users",
      localField: "_id.instructorId",
      foreignField: "id",
      as: "instructor"
    }
  }

  let instructorData = {
    $project: {
      instructor: { 
        $first: "$instructor",
      },
      classes: "$classes",
      totalAttended: "$totalAttended",
      avgAttended: "$avgJoined",
    }
  }

  let report = {
    $project: {
      instructorId: "$_id.instructorId",
      week: "$_id.week",
      year: "$_id.year",
      instructor: { 
        username: "$instructor.username",
        first_name: "$instructor.first_name",
        last_name: "$instructor.last_name",
      },
      totalClasses: "$classes",
      totalAttended: "$totalAttended",
      averageAttended: "$avgAttended",
    }
  }

  let save = {
    $merge: {
      into: "instructorreportings",
      on: "_id",
      whenMatched: "merge",
      whenNotMatched: "insert",
    }
  }

  return Session.aggregate([
    formatData,
    group,
    instructorLookup,
    instructorData,
    report,
    save,
  ])
}

module.exports = {
  returnRate: returnRate,
  classAttendence: classAttendence,
  participantAvg: participantAvg,
  newParticipants: newParticipants,
}