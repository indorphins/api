const db = require('../data/userModel');
const time = require('../utils/getTime');

const classesControler = {};

// TODO add start_time and start_date to init
// create a class (currently set to active when classs is created)
// for now duration can be set to null class will exprie right away
classesControler.createClass = (req, res, next) => {
	const liveTime = time.getTime();
	// participants can be null
	// user_id will = instructor_id so make sure to pass in user_id
	const {
		status,
		instructor_name,
		chat_room_name,
		total_spots,
		user_type,
		user_id,
		duration,
		start_time,
	} = req.body;
	// checks if instructor is creating a class (logs err if user is not a insturctor)
	// will add check for admin for future devlopment
	if (user_type === 1) {
		console.log('Create Class params: ', {
			status,
			instructor_name,
			chat_room_name,
			total_spots,
			user_id,
			duration,
			start_time,
		});

		const text = `
    INSERT INTO classes (created_at, status, instructor_name, chat_room_name, total_spots, duration, instructor_id, start_time) 
    values($1, $2, $3, $4, $5, $6, (Select user_id from users WHERE user_id = ${user_id}), $7)
		RETURNING created_at, status, instructor_name, chat_room_name, total_spots, instructor_id, start_time, class_id
    `;
		const values = [
			liveTime,
			status,
			instructor_name,
			chat_room_name,
			total_spots,
			duration,
			start_time,
		];
		db.query(text, values)
			.then((response) => {
				console.log('Create Class success: ', response);
				res.status(200).json({ success: true, class: response.rows[0] });
			})
			.catch((err) => {
				console.log('Create Class error: ', err);
				res.status(400).json({ success: false, error: err });
			});
	} else {
		console.log('user must be an instructor to create a class'); // note this is just for now we should find a better way to work this
		res
			.status(400)
			.json({ success: false, error: 'only_instructors_can_make_classes' });
	}
	next();
};

// get list of all current active classes (status can change in query to get diffrent state of classes)
classesControler.getActiveClasses = (req, res, next) => {
	const text = `
        SELECT status, chat_room_name, class_id, instructor_name, total_spots, participants, duration, created_at, start_time
        FROM classes
        WHERE status = 'active'
    `;
	db.query(text)
		.then((response) => {
			console.log('Get Classes success');
			res.status(200).json({ success: true, classes: response.rows });
		})
		.catch((err) => {
			res.status(400).json({ success: false, error: err });
		});
	next();
};

// get list of all scheduled classes for given id
classesControler.getScheduledClassesForUser = (req, res, next) => {
	const queryObject = url.parse(req.url, true).query;
	if (!queryObject.user_id) {
		throw new Error("Missing parameter 'user_id' in url");
	}
	const text = `
        SELECT classes
        FROM users
        WHERE user_id = $1
    `;
	const values = [queryObject.user_id];
	db.query(text, values)
		.then((response) => {
			console.log('Get Users classes success is ', response);
			const scheduled = [];
			response.rows[0].forEach((classId) => {
				classesControler.getClass(classId).then((c) => {
					if (c.status === 'scheduled') {
						scheduled.push(c);
					}
				});
			});
			res.status(200).json({ success: true, classes: scheduled });
		})
		.catch((err) => {
			res.status(400).json({ success: false, error: err });
		});
	next();
};

// get list of all closed classes for given id
classesControler.getClosedClassesForUser = (req, res, next) => {
	const queryObject = url.parse(req.url, true).query;
	if (!queryObject.user_id) {
		throw new Error("Missing parameter 'user_id' in url");
	}
	const text = `
        SELECT classes
        FROM users
        WHERE user_id = $1
    `;
	const values = [queryObject.user_id];
	db.query(text, values)
		.then((response) => {
			console.log('Get Users classes success is ', response);
			const closed = [];
			response.rows[0].forEach((classId) => {
				classesControler.getClass(classId).then((c) => {
					if (c.status === 'closed') {
						scheduled.push(c);
					}
				});
			});
			res.status(200).json({ success: true, classes: closed });
		})
		.catch((err) => {
			res.status(400).json({ success: false, error: err });
		});
	next();
};

/**
 * returns a class if class id is found in classes table
 */
classesControler.getClass = (classId) => {
	if (!classId) {
		throw Error('getClass - No ClassID');
	}
	const text = `
    SELECT status, chat_room_name, class_id, instructor_name, total_spots, participants, duration, created_at, start_time
    FROM classes
    WHERE class_id = '${class_id}' 
  `;
	return db
		.query(text)
		.then((response) => {
			console.log('GetClass success - ', response);
			return response.rows[0];
		})
		.catch((error) => {
			console.log('GetClass - error ', error);
			throw error;
		});
};

/*
 * Ends class with time stamp and status changes to closed
 * Takes in class_id in req.body, returns success json { success: true }
 */
classesControler.endClass = (req, res, next) => {
	const liveTime = time.getTime();
	// participants and instructor id can be null right now for MVP
	const { class_id } = req.body;
	console.log('req.body: ', req.body);
	const text = `
	UPDATE classes
	SET updated_at = $1 , status = 'closed'
	WHERE class_id = '${class_id}'
	RETURNING status
`;
	const values = [liveTime];
	db.query(text, values)
		.then((response) => {
			res.status(200).json({ success: true, status: response.rows });
		})
		.catch((err) => {
			console.log('EndClass Error: ', err);
			res.status(400).json({ success: false, error: err });
		});
	next();
};

/*
 * Puts the class in a "loaded" status
 * Takes in class_id in req.body, returns success json { success: true }
 */
classesControler.loadClass = (req, res, next) => {
	const liveTime = time.getTime();
	// participants and instructor id can be null right now for MVP
	const { class_id, class_name } = req.body;
	console.log('req.body: ', req.body);
	const text = `
	UPDATE classes
	SET updated_at = $1 , status = 'loaded', chat_room_name = $2
	WHERE class_id = '${class_id}'
	RETURNING status
`;
	const values = [liveTime, class_name];
	db.query(text, values)
		.then((response) => {
			res.status(200).json({ success: true, status: response.rows });
		})
		.catch((err) => {
			console.log('EndClass Error: ', err);
			res.status(400).json({ success: false, error: err });
		});
	next();
};

// function should run every 30 min - will check if there is any active classes that should be expried
classesControler.checkExpiredClasses = async (req, res, next) => {
	// get current time
	const liveTime = time.getTime();
	var endTime;
	// check start time and duration time
	// want to make a query that gets a all active classes time and duration
	const text = `
        SELECT  class_id, duration, created_at
        FROM classes
        WHERE status = 'active'
		`;
	await db
		.query(text)
		.then((response) => {
			console.log('Get Active classes success');
			// itterate through all active times
			for (let i = 0; i < response.rows.length; i++) {
				const duration = response.rows[i].duration * 60000;
				endTime = new Date(response.rows[i].created_at.getTime() + duration);
				if (endTime < new Date(liveTime)) {
					db.query(
						`UPDATE classes
					SET status = 'closed'
					WHERE class_id = '${response.rows[i].class_id}' `
					).catch((err) => {
						res.status(400).json({ success: false, error: err });
					});
				}
			}
			console.log('CheckExpiredClasses Success: ', response);
			res.status(200).json({ success: true });
		})
		.catch((err) => {
			console.log('CheckExpiredClasses Error: ', err);
			res.status(400).json({ success: false, error: err });
		});
	next();
};

classesControler.wipeActiveClasses = (req, res, next) => {
	db.query(`DELETE FROM classes WHERE status = 'active';`)
		.then((response) => {
			res.status(200).json({ success: true });
		})
		.catch((err) => {
			res.status(400).json({ success: false, error: err });
		});
};

classesControler.wipeClosedClasses = (req, res, next) => {
	db.query(`DELETE FROM classes WHERE status = 'closed';`)
		.then((response) => {
			res.status(200).json({ success: true });
		})
		.catch((err) => {
			res.status(400).json({ success: false, error: err });
		});
};

module.exports = classesControler;
