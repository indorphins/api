const mongoose = require('mongoose');

const InstructorReportings = new mongoose.Schema({
  week: {
    type: 'Number',
    required: true
  },
  year: {
    type: 'Number',
    required: true
  },
  instructorId: {
    type: 'String',
    required: false
  },
  startDate: {
    type: 'Date',
    required: true
  },
  endDate: {
    type: 'Date',
    required: true
  },
});

InstructorReportings.index({ week: -1 });
InstructorReportings.index({ year: -1 });
InstructorReportings.index({ instructor: 1});
InstructorReportings.index({ startDate: -1 });
InstructorReportings.index({ endDate: -1 });

module.exports = mongoose.model('InstructorReportings', InstructorReportings);