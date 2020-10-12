const ClassFeedback = require('../src/db/ClassFeedback');

async function classFeedbackForms() {

  let format = {
    $project: {
      year: { $isoWeekYear: "$created_date"},
      week: { $isoWeek: "$created_date" },
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

module.exports = {
  classFeedbackForms: classFeedbackForms
};