const Milestone = require('../db/Milestone');
const Class = require('../db/Class');
const log = require('../log');
const utils = require('../utils/milestone');

async function updateMilestone(req, res) {
  const userId = req.ctx.userDate.id;
  const classId = req.params.id;

  let c, milestone;

  try {
    c = await Class.findOne({ id: classId });
  } catch (err) {
    log.warn("database error", err);
    return res.status(500).json({
      message: "Database error",
      error: err,
    });
  }

  try {
    milestone = await Milestone.findOne({ user_id: userId })
  } catch (err) {
    log.warn("database error", err);
    return res.status(500).json({
      message: "Database error",
      error: err,
    });
  }

  if (!milestone) {
    milestone = utils.getNewMilestone(userId);
  }

  // Update Instructor Milestone
  if (c.instructor === userId) {
    // TODO Use different field for who joins the session than participants
    if (c.participants.length == 0) {
      log.info("No participants from class - no milestones to update");
      return res.status(400).json({
        message: "no_users_in_class"
      })
    }
  
    let participants = c.participants.map(participant => {
      return participant.id;
    });
  
    milestone = utils.updateInstructorMilestones(milestone, participants, c);
  } else {
    // Update User Milestone
    milestone = utils.updateParticipantMilestones(milestone, c);
  }

  try {
    await Milestone.update({ user_id: userId }, milestone);
  } catch (err) {
    log.warn("Error updating milestone");
    return res.status(500).json({
      message: "Database error",
      error: err
    });
  }

  return res.status(200).json(milestone);
} 

