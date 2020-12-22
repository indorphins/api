const User = require('../db/User');
const Class = require('../db/Class');
const log = require('../log');
const { asyncForEach } = require('../utils/index');

async function getList(req, res) {
	let page = req.query.page ? Number(req.query.page) - 1 : 0;
	let limit = req.query.limit ? Number(req.query.limit) : 50;

	let filter = {
    type: "instructor"
  }

  let order = {};

	let total;
	let results;

	try {
		total = await User.find(filter).countDocuments();
		results = await User.find(filter).sort(order).skip(page*limit).limit(limit);
	} catch (err) {
		res.status(500).json({
			message: err,
		});
	}

	res.status(200).json({
		total: total,
		page: page + 1,
		limit: limit,
		data: results,
	});
};

async function get(req, res) {
	let id = req.params.id;
	let user;

	try {
		user = await User.findOne({ id: id })
	} catch (err) {
		log.warn('getUser - error: ', err);
		return res.status(404).json({
			message: err,
		});
	}

	if (!user) {
		return res.status(404).json({
			message: "User not found",
		});
  }
  
  if (user.type !== "instructor") {
    return res.status(403).json({
      message: "Not authorized"
    })
  }

	res.status(200).json({
		data: user,
	});
}

// Fetches all the usernames and emails of every unique user that has taken a class with an instructor
async function uniqueParticipants(req, res) {
  const userData = req.ctx.userData;

  if (userData.type !== 'admin') {
    log.warn("Only admins can fetch this data");
    return res.status(404).json({
      message: "Only admins can fetch this data"
    })
  }

  let instructors;
  try {
    instructors = await User.find({ type: 'instructor' });
  } catch (err) {
    log.warn("uniqueParticipants report database error ", err);
    return res.status(500).json({
      message: 'database error'
    })
  }

  let instructorMap = {};
  await asyncForEach(instructors, async i => {
    let classes;
    try {
      classes = await Class.find({ instructor: i.id });
    } catch (err) {
      log.warn("uniqueParticipants Database error ", err);
      return res.status(500).json({
        message: 'database error'
      })
    }

    let participants = [];
    if (classes && classes.length > 0) {
      classes.map(c => {
        let userIds = c.participants.map(participant => {
          return participant.id;
        });
        participants = [...participants, ...userIds];
      })
    }

    let users;
    try {
      users = await User.find({ id: { $in: participants }});
    } catch (err) {
      log.warn("database error", err);
      return res.status(500).json({
        message: 'database error'
      })    }

    let data = users.map(user => {
      return {
        username: user.username,
        email: user.email,
      }
    });

    instructorMap[i.username] = data;
  })

  return res.status(200).json(instructorMap);
}

module.exports = {
  get,
  getList,
  uniqueParticipants
};