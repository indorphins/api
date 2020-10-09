const process = require('process');
const mongoose = require('mongoose');
const db = require('../src/db');
const User = require('../src/db/User');
const Transaction = require('../src/db/Transaction');
const Session = require('../src/db/Session');

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
  return User.countDocuments();
}

async function transactionsAgg() {
  return Transaction.aggregate([
    { 
      $project: {
        classId: "$classId",
        userId: "$userId",
        date: "$created_date",
        amount: { 
          $cond: { 
            if: { $eq: ["$type", "debit"] },
            then: "$amount",
            else: {$multiply: [-1, "$amount"]}
          }
        }
      }
    },
    {
      $group: {
        _id: {
          classId: "$classId",
          userId: "$userId"
        },
        total: {
          $sum: "$amount"
        }
      }
    },
    {
      $group: {
        _id: "$_id.classId",
        users: {
          $push: {
            id: "$_id.userId",
            amount: "$total",
          }
        },
        total: {
          $sum: "$total"
        }
      }
    }, 
    {
      $project: {
        total: "$total",
        paid: {
          $filter: {
            input: "$users",
            as: "user",
            cond: { $gt: [ "$$user.amount", 0 ] }
          }
        },
        refunded: {
          $filter: {
            input: "$users",
            as: "user",
            cond: { $lte: [ "$$user.amount", 0 ] }
          }
        }
      }
    },
    {
      $project: {
        type: "t",
        total: "$total",
        paid: {
          $size: "$paid",
        },
        refunded: {
          $size: "$refunded",
        }
      }
    },
    {
      $group: {
        _id: "$type",
        totalRevenue: {
          $sum: "$total"
        },
        classesBooked: {
          $sum: "$paid",
        },
        classesRefunded: {
          $sum: "$refunded",
        }
      }
    }
  ])
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
      week: { $week: "$start_date" },
      day: { $dayOfYear: "$start_date" }
    } 
  };

  let uwind = {
    $unwind: {
      path: "$joined",
      preserveNullAndEmptyArrays: false,
    }
  };


  let allGroup = {
    $group: {
      _id: "$instructor",
      classes: {
        $sum: 1,
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

  let weekGroup = {
    $group: {
      _id: {
        week: "$week",
        instructor: "$instructor",
      },
      classes: {
        $sum: 1,
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

  let format = {
    $project: {
      classes: "$classes",
      joined: {
        $size: "$joined",
      },
      noShow: "$noShow",
    }
  }

  return Session.aggregate([
    formatData,
    uwind,
    weekGroup,
    //format
  ])
}

async function run() {
  console.log("Running queries");

  try {
    connect();
  } catch(e) {
    console.error(e)
  }

  /*let result = null;

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

  console.log("\nData:\n", trans);*/

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