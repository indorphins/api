const Transaction = require('../src/db/Transaction');

async function classBooking() {

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
        $cond: {
          if: { $isArray: "$debits.total"},
          then: { $size: "$debits.total"},
          else: 0,
        }
      },
      uniqueBooked: {
        $cond: {
          if: { $isArray: "$debits.unique"},
          then: { $size: "$debits.unique"},
          else: 0,
        }
      },
      totalRefunded: {
        $cond: {
          if: { $isArray: "$credits.total"},
          then: { $size: "$credits.total"},
          else: 0,
        }
      },
      uniqueRefunded: {
        $cond: {
          if: { $isArray: "$credits.unique"},
          then: { $size: "$credits.unique"},
          else: 0,
        }
      },
      totalRevenue: "$sum",
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


  return Transaction.aggregate([
    formatted,
    typeGroup,
    weekGroup,
    sortTypes,
    reportFormat,
    save,
  ]);
}

module.exports = {
  classBooking: classBooking,
}