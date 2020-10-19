const { UserSessions } = require('./usersessions');

async function cohortSize() {
  let filter = {
    $match: {
      accountCreated: {
        $exists: true,
      }
    }
  }

  let format = {
    $project: {
      created: {
        year: { $year: "$accountCreated" },
        month: { $month: "$accountCreated" },
      },
    }
  }

  let cohortGroup = {
    $group: {
      _id: {
        createdYear: "$created.year",
        createdMonth: "$created.month",
      },
      cohort: {
        $sum: 1,
      }
    }
  }

  let report = {
    $project: {
      newUsers: "$cohort",
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


  return UserSessions.aggregate([
    filter,
    format,
    cohortGroup,
    report,
    save,
  ])
}

async function monthlyRetention() {
  let d = new Date();

  let filter = {
    $match: {
      accountCreated: {
        $exists: true,
      }
    }
  }

  let format = {
    $project: {
      today: {
        year: { $year: d},
        month: { $month: d},
        
      },
      created: {
        year: { $year: "$accountCreated" },
        month: { $month: "$accountCreated" },
      },
      classDates: {
        $cond: {
          if: { $isArray: "$classDates"},
          then: {
            $map: {
              input: "$classDates",
              as: "d",
              in: {
                year: { $year: "$$d" },
                month: { $month: "$$d" },
              }
            }
          },
          else: [],
        }
      }
    }
  }

  let fillUserMissingMonths = {
    $set: {
      data: {
        $function: {
          body: `function(today, created, classDates) {
            let diff = today.year - created.year;

            let final = [{
              index: 1,
              month: created.month,
              year: created.year,
              tookClass: false,
            }];
            let index = 1;
            
            if (diff > 0) {
            
              let years = [created.year];
              for (var i = 1; i <= diff; i++) {
                years.push(created.year + i);
              }
            
            
              years.forEach(function(yearIndex) {
          
                if (yearIndex === created.year) {
                  let createdDiff = 12 - created.month;
      
                  for (var i = 1; i <= createdDiff; i++) {
                    index = index + 1;
                    final.push({
                      index: index,
                      month: created.month + i,
                      year: yearIndex,
                      tookClass: false,
                    });
                  }
                } else if (yearIndex === today.year) {
        
                  let todayDiff = today.month;
      
                  for (var i = 1; i <= todayDiff; i++) {
                    index = index + 1;
                    final.push({
                      index: index,
                      month: i,
                      year: yearIndex,
                      tookClass: false,
                    });
                  }
        
                } else {
                  for (var i = 1; i <= 12; i++) {
                    index = index + 1;
                    final.push({
                      index: index,
                      month: i,
                      year: yearIndex,
                      tookClass: false,
                    });
                  }
                }
            });
            
            } else {
            
              let wDiff = today.month - created.month;
          
              for (var i = 1; i <= wDiff; i++) {
                index = index + 1;
                final.push({
                  index: index,
                  month: created.month + i,
                  year: created.year,
                  tookClass: false,
                });
              }
            }
            
            classDates.forEach(function(c) {
              let match = final.filter(function(item) {
                return item.month === c.month && item.year === c.year;
              })[0];
          
              if (match) {
                match.tookClass = true;
              }
            });
            
            return final;
          }`,
          args: ["$today", "$created", "$classDates"],
          lang: "js"
        }
      }
    }
  }

  let unwind = {
    $unwind: {
      path: "$data",
      preserveNullAndEmptyArrays: true,
    }
  }

  let tookClassGroup = {
    $group: {
      _id: {
        createdYear: "$created.year",
        createdMonth: "$created.month",
        monthIndex: "$data.index",
        tookClass: "$data.tookClass",
      },
      total: {
        $sum: 1
      }
    }
  }

  let sort = {
    $sort: {
      "_id.createdYear": 1,
      "_id.createdMonth": 1,
      "_id.monthIndex": 1,
    }
  }

  let transform = {
    $project: {
      totalTookClass: {
        $cond: {
          if: { $eq: ["$_id.tookClass", true] },
          then: "$total",
          else: 0,
        }
      },
      totalNoClass: {
        $cond: {
          if: { $eq: ["$_id.tookClass", false] },
          then: "$total",
          else: 0,
        }
      }
    }
  }

  let indexGroup = {
    $group: {
      _id: {
        createdYear: "$_id.createdYear",
        createdMonth: "$_id.createdMonth",
        monthIndex: "$_id.monthIndex",
      },
      totalTookClass: {
        $sum: "$totalTookClass",
      },
      totalNoClass: {
        $sum: "$totalNoClass",
      }
    }
  }


  let retention = {
    $set: {
      retentionRate: {
        $divide: [
          "$totalTookClass",
          { $add: ["$totalTookClass", "$totalNoClass"] }
        ]
      }
    }
  }

  let createdMonthGroup = {
    $group: {
      _id: {
        createdYear: "$_id.createdYear",
        createdMonth: "$_id.createdMonth",
      },
      data: {
        $push: {
          monthIndex: "$_id.monthIndex",
          retentionRate: "$retentionRate",
          cohortSize: "$total",
        }
      }
    }
  }

  let sortCreated = {
    $sort: {
      "_id.createdYear": 1,
      "_id.createdMonth": 1,
    }
  }

  let setSize = {
    $set: {
      total: {
        $size: "$data"
      }
    }
  }
  
  let recent = {
    $match: {
      total: { $lte: 12 }
    }
  }

  let mapped = {
    $project: {
      monthlyRetention: {
        $function: {
          body: `function(data) {
            let updated = data.sort(function(a, b) {
              return a.monthIndex - b.monthIndex;
            });

            let mapped = {};

            for (var i = 0; i < updated.length; i++) {
              let current = updated[i];
              mapped[current.monthIndex] = current.retentionRate;
            }

            return mapped;
          }`,
          args: ["$data"],
          lang: "js",
        }
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

  return UserSessions.aggregate([
    filter,
    format,
    fillUserMissingMonths,
    unwind,
    tookClassGroup,
    sort,
    transform,
    indexGroup,
    sort,
    retention,
    createdMonthGroup,
    sortCreated,
    setSize,
    recent,
    mapped,
    save,
  ])
}

module.exports = {
  monthlyRetention: monthlyRetention,
  cohortSize: cohortSize,
}