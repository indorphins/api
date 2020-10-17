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

module.exports = {
  UserSessions: UserSessions,
  userSessionsCollection: userSessionsCollection,
  userSessionsAgg: userSessionsAgg,
  instructorSessionsAgg: instructorSessionsAgg,
  userTransactionsAgg: userTransactions,
}