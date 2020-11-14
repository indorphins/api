const User = require('../src/db/User');
const Session = require('../src/db/Session');
const Transaction = require('../src/db/Transaction');
const mongoose = require('mongoose');

const userSession = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
});
const UserSessions = mongoose.model('usersession', userSession);

async function userSessionsCollection() {

  let formatted = { 
    $project: {
      _id: "$id",
      accountCreated: "$created_date",
      classDates: [],
      classInstructedDates: [],
    }
  };

  let save = {
    $merge: {
      into: "usersessions",
      on: "_id",
      whenMatched: "merge",
      whenNotMatched: "insert",
    }
  }

  return User.aggregate([
    formatted,
    save,
  ]);
}

async function userTransactions() {

  let match = {
    $match: {
      type: "debit"
    }
  }

  let group = {
    $group: {
      _id: "$userId",
      totalSpent: {
        $sum: "$amount"
      },
      classDates: {
        $push: "$created_date",
      }
    }
  }

  let save = {
    $merge: {
      into: "usersessions",
      on: "_id",
      whenMatched: "merge",
      whenNotMatched: "insert",
    }
  }

  return Transaction.aggregate([
    match,
    group,
    save,
  ]);
}

async function instructorSessionsAgg() {
  let format = {
    $project: {
      instructorId: "$instructor_id",
      date: "$start_date",
    } 
  };

  let group = {
    $group: {
      _id: "$instructorId",
      classInstructedDates: {
        $push: "$date",
      }
    }
  }

  let save = {
    $merge: {
      into: "usersessions",
      on: "_id",
      whenMatched: "merge",
      whenNotMatched: "insert",
    }
  }

  return Session.aggregate([
    format,
    group,
    save,
  ]);
}

async function userSessionsAgg() {
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
      date: "$start_date",
    } 
  };

  let unwind = {
    $unwind: "$users"
  }

  let sortByDate = {
    $sort: {
      "date": -1
    }
  }

  let group = {
    $group: {
      _id: "$users",
      classDates: {
        $push: "$date",
      }
    }
  }

  let save = {
    $merge: {
      into: "usersessions",
      on: "_id",
      whenMatched: "merge",
      whenNotMatched: "insert",
    }
  }

  return Session.aggregate([
    format,
    unwind,
    sortByDate,
    group,
    save,
  ]);
}

async function classCountBuckets() {

  let format = {
    $project: {
      classDates: {
        $size: "$classDates",
      }
    }
  }

  let bucket = {
    $bucket: {
      groupBy: "$classDates",
      boundaries: [0,1,2,6,11,21,1000],
      default: "other",
      output: {
        "count": {
          $sum: 1,
        },
        "users": {
          $push: "$_id"
        }
      }
    }
  }


  let match = {
    $match: {
      _id:1
    }
  }

  let unwindUsers = {
    $unwind: "$users"
  }

  let lookupEmail = {
    $lookup: {
      from: "users",
      localField: "users",
      foreignField: "id",
      as: "userData",
    }
  }

  let unwindUserData = {
    $unwind: "$userData"
  }

  let emailFormat = {
    $project: {
      _id: "$userData.id",
      classes: "$_id",
      email: "$userData.email"
    }
  }

  let save = {
    $merge: {
      into: "temp_emails",
      on: "_id",
      whenMatched: "merge",
      whenNotMatched: "insert",
    }
  }


  let a = {
    $set: {
      classRange: "a"
    }
  }

  let totalGroup = {
    $group: {
      _id: "classRange",
      total: {
        $sum: "$count"
      },
      data: {
        $push: {
          bucket: {
            $switch: {
              branches: [
                 { case: { $eq: ["$_id", 0]}, then: "0" },
                 { case: { $eq: ["$_id", 1]}, then: "1" },
                 { case: { $eq: ["$_id", 2]}, then: "2-5" },
                 { case: { $eq: ["$_id", 6]}, then: "6-10" },
                 { case: { $eq: ["$_id", 11]}, then: "11-20" },
                 { case: { $eq: ["$_id", 21]}, then: "21+" },
              ],
              default:{ $eq: ["$_id", 0]},
            }
          },
          total: "$count",
        }
      }
    }
  }

  let unwind =  {
    $unwind: "$data"
  }

  let percent = {
    $set: {
      percent: {
        $divide: [
          "$data.total",
          "$total"
        ]
      }
    }
  }

  let report = {
    $project: {
      percentage: "$percent",
      numberOfClasses: "$data.bucket"
    }
  }

  return UserSessions.aggregate([
    format,
    bucket,
    match,
    unwindUsers,
    lookupEmail,
    unwindUserData,
    emailFormat,
    //emailGroup,
    save,
    //emailGroup,
    /*a,
    totalGroup,
    unwind,
    percent,
    report,*/
  ])
}

async function ARPU() {
  let format = {
    $project: {
      userId: "$userId",
      amount: { 
        $cond: { 
          if: { $eq: ["$type", "debit"] },
          then: "$amount",
          else: {$multiply: [-1, "$amount"]}
        }
      }
    }
  }

  let group = {
    $group: {
      _id:  "$userId",
      totalSpent: {
        $sum: "$amount"
      }
    }
  }

  let avg = {
    $group: {
      _id:  null,
      averageLifetimeRevPerUser: {
        $avg: "$totalSpent"
      }
    }
  }

  return Transaction.aggregate([
    format,
    group,
    avg,
  ]);
}

async function monthlyARPU() {


  let getMonth = {
    $set: {
      month: {
        $month: "$created_date",
      },
      year: {
        $year: "$created_date",
      },
      amount: { 
        $cond: { 
          if: { $eq: ["$type", "debit"] },
          then: "$amount",
          else: {$multiply: [-1, "$amount"]}
        }
      }
    }
  }

  let avg = {
    $group: {
      _id: {
        userId: "$userId",
        month: "$month",
        year: "$year",
      },
      totalSpent: {
        $sum: "$amount"
      }
    }
  }

  let group = {
    $group: {
      _id: {
        month: "$_id.month",
        year: "$_id.year",
      },
      averageRevPerUser: {
        $avg: "$totalSpent"
      }
    }
  }
  
  let save = {
    $merge: {
      into: "monthlyreportings",
      on: "_id",
      whenMatched: "merge",
      whenNotMatched: "insert",
    }
  }

  return Transaction.aggregate([
    getMonth,
    avg,
    group,
    save,
  ]);
}

async function promoCodes() {
  let filter = {
    $match: {
      campaignId: {
        $ne: null
      }
    }
  }

  let group = {
    $group: {
      _id: null,
      promoCodesUsed: {
        $sum: 1,
      }
    }
  }

  return Transaction.aggregate([
    filter,
    group,
  ])
}

module.exports = {
  UserSessions: UserSessions,
  userSessionsCollection: userSessionsCollection,
  userSessionsAgg: userSessionsAgg,
  instructorSessionsAgg: instructorSessionsAgg,
  userTransactionsAgg: userTransactions,
  classCountBuckets: classCountBuckets,
  ARPU: ARPU,
  monthlyARPU,
  promoCodes: promoCodes,
}