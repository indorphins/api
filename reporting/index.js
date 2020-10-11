const process = require('process');
const mongoose = require('mongoose');
const db = require('../src/db');
const User = require('../src/db/User');
const Transaction = require('../src/db/Transaction');
const Session = require('../src/db/Session');
const differenceInWeeks = require('date-fns/differenceInWeeks');

/**
 * disconnect from mongo DB at end of run
 */
function disconnect() {
  mongoose.connection.close();
}

/**
 * connect to mongo DB
 */
async function connect() {
  db.init((e) => {
    if (e) throw e;
    return;
  })
}

async function countUsers() {
  let d = new Date();
  return User.aggregate([
    {
      $group: {
        _id: "$type",
        total: {
          $sum: 1,
        }
      }
    },
  ])
}


async function transactionsAgg() {

  let formatted = { 
    $project: {
      userId: "$userId",
      year: { $year: "$created_date"},
      week: { $week: "$created_date" },
      type: "$type",
      amount: { 
        $cond: { 
          if: { $eq: ["$type", "debit"] },
          then: "$amount",
          else: {$multiply: [-1, "$amount"]}
        }
      }
    }
  };

  let typeGroup = {
    $group: {
      _id: {
        type: "$type",
        year: "$year",
        week: "$week",
      },
      total: {
        $push: "$userId"
      },
      unique: {
        $addToSet: "$userId"
      },
      sum: {
        $sum: "$amount"
      }
    }
  };

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
          unique: "$unique",
        }
      },
      sum: {
        $sum: "$sum",
      }
    }
  };

  let sortTypes = {
    $project: {
      debits: {
        $first: {
          $filter: {
            input: "$data",
            as: "d",
            cond: {
              $eq: ["$$d.type", "debit"],
            }
          }
        }
      },
      credits: {
        $first: {
          $filter: {
            input: "$data",
            as: "d",
            cond: {
              $eq: ["$$d.type", "credit"],
            }
          }
        }
      },
      sum: "$sum",
    }
  };

  let reportFormat = {
    $project: {
      week: "$_id.week",
      year: "$_id.year",
      totalBooked: {
        $size: "$debits.total"
      },
      uniqueBooked: {
        $size: "$debits.unique"
      },
      totalRefunded: {
        $size: "$credits.total"
      },
      uniqueRefunded: {
        $size: "$credits.unique"
      },
      totalRevenue: "$sum",
    }
  }

  return Transaction.aggregate([
    formatted,
    typeGroup,
    weekGroup,
    sortTypes,
    reportFormat,
  ]);
}

async function sessionAgg() {

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
      uniqueJoined: {
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

async function run() {
  console.log("Running queries");

  try {
    connect();
  } catch(e) {
    console.error(e)
  }

  let result = null;

  try {
    result = await countUsers();
  } catch(err) {
    console.error(err);
    disconnect();
    return process.exit(1);
  }

  console.log("Data:\n", result);

  let trans;

  try {
    trans = await transactionsAgg();
  } catch(err) {
    console.error(err);
    disconnect();
    return process.exit(1);
  }

  console.log("\nData:\n", trans);

  let s;

  try {
    s = await sessionAgg();
  } catch(err) {
    console.error(err);
    disconnect();
    return process.exit(1);
  }

  console.log("\nData:\n", s);

  process.exit();
}

run();