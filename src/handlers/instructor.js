const User = require('../db/User');

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
	let query = { id: id };
	let user;

	try {
		user = await User.findOne(query)
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

module.exports = {
  get,
	getList
};