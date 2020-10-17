const { UserSessions } = require('./usersessions');

async function weeklyRetention() {
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
        week: { $isoWeek: d},
        
      },
      created: {
        year: { $year: "$accountCreated" },
        week: { $isoWeek: "$accountCreated" },
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
                week: { $isoWeek: "$$d" },
              }
            }
          },
          else: [],
        }
      }
    }
  }

  let fillUserMissingWeeks = {
    $set: {
      data: {
        $function: {
          body: `function(today, created, classDates) {
            function getISOWeeks(y) {
              var d,
                  isLeap;
            
              d = new Date(y, 0, 1);
              isLeap = new Date(y, 1, 29).getMonth() === 1;
            
              //check for a Jan 1 that's a Thursday or a leap year that has a 
              //Wednesday jan 1. Otherwise it's 52
              return d.getDay() === 4 || isLeap && d.getDay() === 3 ? 53 : 52
            }
            
            let diff = today.year - created.year;
            let final = [{
                index: 1,
                week: created.week,
                year: created.year,
                tookClass: false,
            }];
            let index = 1;
            
            if (diff > 0) {
            
              let years = [created.year];
              for (var i = 1; i <= diff; i++) {
                years.push(created.year + i);
              }
            
              let yearWeeks = years.map(function(item) {
                return {
                  year: item,
                  week: getISOWeeks(item),
                };   
              });
            
            
              yearWeeks.forEach(function(yearIndex) {
            
                if (yearIndex.year === created.year) {
                  let createdDiff = yearIndex.week - created.week;
            
                  for (var i = 1; i <= createdDiff; i++) {
                    index = index + 1;
                    final.push({
                      index: index,
                      week: created.week + i,
                      year: yearIndex.year,
                      tookClass: false,
                    });
                  }
                } else if (yearIndex.year === today.year) {
            
                  let todayDiff = today.week;
            
                  for (var i = 1; i <= todayDiff; i++) {
                    index = index + 1;
                    final.push({
                      index: index,
                      week: i,
                      year: yearIndex.year,
                      tookClass: false,
                    });
                  }
            
                } else {
                  for (var i = 1; i <= yearIndex.week; i++) {
                    index = index + 1;
                    final.push({
                      index: index,
                      week: i,
                      year: yearIndex.year,
                      tookClass: false,
                    });
                  }
                }
              });
            
            
            } else {
            
              let wDiff = today.week - created.week;
            
              for (var i = 1; i <= wDiff; i++) {
                index = index + 1;
                final.push({
                  index: index,
                  week: created.week + i,
                  year: created.year,
                  tookClass: false,
                });
              }
            }
            
            classDates.forEach(function(c) {
              let match = final.filter(function(item) {
                return item.week === c.week && item.year === c.year;
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
        createdWeek: "$created.week",
        weekIndex: "$data.index",
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
      "_id.createdWeek": 1,
      "_id.weekIndex": 1,
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
        createdWeek: "$_id.createdWeek",
        weekIndex: "$_id.weekIndex",
      },
      totalTookClass: {
        $sum: "$totalTookClass",
      },
      totalNoClass: {
        $sum: "$totalNoClass",
      },
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

  let createdWeekGroup = {
    $group: {
      _id: {
        createdYear: "$_id.createdYear",
        createdWeek: "$_id.createdWeek",
      },
      data: {
        $push: {
          weekIndex: "$_id.weekIndex",
          retentionRate: "$retentionRate",
        }
      }
    }
  }

  let sortCreated = {
    $sort: {
      "_id.createdYear": 1,
      "_id.createdWeek": 1,
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
      weeks: {
        $function: {
          body: `function(data) {
            let updated = data.sort(function(a, b) {
              return a.weekIndex - b.weekIndex;
            });

            let mapped = {};

            for (var i = 0; i < updated.length; i++) {
              let current = updated[i];
              mapped[current.weekIndex] = current.retentionRate;
            }

            return mapped;
          }`,
          args: ["$data"],
          lang: "js",
        }
      }
    }
  }

  return UserSessions.aggregate([
    filter,
    format,
    fillUserMissingWeeks,
    unwind,
    tookClassGroup,
    sort,
    transform,
    indexGroup,
    sort,
    retention,
    createdWeekGroup,
    sortCreated,
    setSize,
    recent,
    mapped,
  ])
}

module.exports = {
  weeklyRetention: weeklyRetention,
}