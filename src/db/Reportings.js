const mongoose = require('mongoose');

const Reportings = new mongoose.Schema({
  week: {
    type: 'Number',
    required: true
  },
  year: {
    type: 'Number',
    required: true
  },
  instructor: {
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

Reportings.index({ week: 1 });
Reportings.index({ year: 1 });
Reportings.index({ instructor: 1});
Reportings.index({ startDate: 1 });
Reportings.index({ endDate: 1 });

module.exports = mongoose.model('Reportings', Reportings);