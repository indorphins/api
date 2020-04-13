const db = require('../data/userModel');
const fetch = require('node-fetch');
// function to get timestamp of current time (formated to send to db)
const time = require('../utils/getTime');

const classesControler = {};

// create a class (currently set to active when classs is created)
// TODO add duration field to initializer and return value
classesControler.createClass = (req, res, next) => {
	const liveTime = time.getTime();
	// participants and insturctor id can be null right now for MVP
	const {
		status,
		instructor_name,
		chat_room_name,
		total_spots,
		user_type,
	} = req.body;
	// checks if instructor is creating a class (logs err if user is not a insturctor)
	// will add check for admin for future devlopment
	if (user_type === 1) {
		console.log('Create Class params: ', {
			status,
			instructor_name,
			chat_room_name,
			total_spots,
		});
		const text = `
		INSERT INTO classes (created_at, status, instructor_name, chat_room_name, total_spots, instructor_id)
    values($1, $2, $3, $4, $5, (Select user_id from users WHERE user_id = 1))
    RETURNING class_id, status, instructor_name, chat_room_name, total_spots, instructor_id
    `;
		const values = [
			liveTime,
			status,
			instructor_name,
			chat_room_name,
			total_spots,
		];
		db.query(text, values)
			.then((response) => {
				console.log('Create Class success');
				res.status(200).json({ success: true, class: response.rows[0] });
			})
			.catch((err) => {
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
        SELECT status, chat_room_name, class_id, instructor_name, total_spots, pariticipants, duration
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
`;
	const values = [liveTime];
	console.log('END CLASS id ', class_id);
	db.query(text, values)
		.then((response) => {
			console.log('EndClass Success ', response);
			res.status(200).json({ success: true });
		})
		.catch((err) => {
			console.log('EndClass Error: ', err);
			res.status(400).json({ success: false, error: err });
		});
	next();
};

module.exports = classesControler;
