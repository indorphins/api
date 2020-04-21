const db = require('../data/userModel');
const fetch = require('node-fetch');
// function to get timestamp of current time (formated to send to db)
const time = require('../utils/getTime');

const classesControler = {};

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
		});

		const text = `
		INSERT INTO classes (created_at, status, instructor_name, chat_room_name, total_spots, duration, instructor_id)
		values($1, $2, $3, $4, $5, $6, (Select user_id from users WHERE user_id = ${user_id}))
		RETURNING created_at, status, instructor_name, chat_room_name, total_spots, instructor_id
    `;
		const values = [
			liveTime,
			status,
			instructor_name,
			chat_room_name,
			total_spots,
			duration,
		];
		db.query(text, values)
			.then((response) => {
				console.log('Create Class success: ', response);
				res.status(200).json({ success: true, class_name: response.rows });
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
classesControler.getClasses = (req, res, next) => {
	// TODO fix participants spelling in DB and here
	// TODO add duration
	const text = `
        SELECT status, chat_room_name, class_id, instructor_name, total_spots, participants, duration
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
	console.log('END CLASS id ', class_id);
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
	await db.query(text)
		.then((response) => {
			console.log('Get Active classes success');
			// itterate through all active times 
			for (let i = 0; i < response.rows.length; i++) {
				const duration = (response.rows[i].duration * 60000)
				console.log(response.rows[i].created_at)
				endTime = new Date(response.rows[i].created_at.getTime() + duration)
				console.log('THIS IS ENDTIME', endTime)
				console.log('THIS IS LIVETIME', new Date(liveTime))
				if (endTime < new Date(liveTime)) {
					console.log('IM INSIDE IF STATEMENT')
					db.query(`UPDATE classes
					SET status = 'closed'
					WHERE class_id = '${response.rows[i].class_id}' `)
						.catch((err) => {
							res.status(400).json({ success: false, error: err });
						});
				}
			}
			res.status(200).json({ success: true });
		})
		.catch((err) => {
			res.status(400).json({ success: false, error: err });
		});
	next();
}

classesControler.wipeActiveClasses = (req, res, next) => {
	db.query(`DELETE FROM classes WHERE status = 'active';`)
		.then((response) => {
			res.status(200).json({ success: true });
		})
		.catch((err) => {
			res.status(400).json({ success: false, error: err });
		});
}

classesControler.wipeClosedClasses = (req, res, next) => {
	db.query(`DELETE FROM classes WHERE status = 'closed';`)
		.then((response) => {
			res.status(200).json({ success: true });
		})
		.catch((err) => {
			res.status(400).json({ success: false, error: err });
		});
}

module.exports = classesControler;
