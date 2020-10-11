const Session = require('../src/db/Session');
const ClassFeedback = require('../src/db/ClassFeedback');

async function classFeedbackForms() {

  let format = {
    $project: {
      year: { $year: "$created_date"},
      week: { $week: "$created_date" },
      instructorId: "$instructorId",
      instructorRating: "$instructorRating",
      classRating: "$classRating",
      videoRating: "$videoRating",
    } 
  }

  let group = {
    $group: {
      _id: {
        year: "$year",
        week: "$week",
        instructorId: "$instructorId",
      },
      instructorRating: {
        $avg: "$instructorRating",
      },
      classRating: {
        $avg: "$classRating",
      },
      videoRating: {
        $avg: "$videoRating",
      }
    }
  };

  let report = {
    $project: {
      week: "$_id.week",
      year: "$id_.year",
      instructorId: "$_id.instructorId",
      averageInstructorRating: "$instructorRating",
      averageClassRating: "$classRating",
      averageVideoRating: "$videoRating",
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

  return ClassFeedback.aggregate([
    format,
    group,
    report,
    save,
  ])
}

async function classAttendence() {

  let format = {
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
      avgJoined: {
        $avg: "$joined"
      }
    }
  }

  let report = {
    $project: {
      instructorId: "$_id.instructorId",
      week: "$_id.week",
      year: "$_id.year",
      totalClasses: "$classes",
      averageJoined: "$avgJoined",
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
    report,
    save,
  ])
}

module.exports = {
  returnRate: returnRate,
  classAttendence: classAttendence,
  participantAvg: participantAvg,
  classFeedbackForms: classFeedbackForms,
}