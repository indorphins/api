const mongoose = require('mongoose');

const ClassFeedback = new mongoose.Schema({
  classId: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
  sessionId: {
    type: String,
    required: true,
  },
  instructorId: {
    type: String,
    required: true,
  },
  classRating: {
    type: Number,
  },
  instructorRating: {
    type: Number,
  },
  videoRating: {
    type: Number,
  },
  comments: {
    type: String,
  },
  created_date: {
		type: Date,
		required: true,
	},
});

ClassFeedback.index({ instructorId: 1 });
ClassFeedback.index({ classId: 1 });

module.exports = mongoose.model('ClassFeedback', ClassFeedback);