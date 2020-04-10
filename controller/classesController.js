const db = require('../data/userModel');
const fetch = require('node-fetch');
const time = require('../utils/getTime');

const classesControler = {};

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
	if (user_type === 1) {
		console.log('Create Class params: ', {
			status,
			instructor_name,
			chat_room_name,
			total_spots,
		});
		const text = `
	INSERT INTO classes (created_at, status, instructor_name, chat_room_name, total_spots)
	values($1, $2, $3, $4, $5)
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
				console.log('Create Class success: ', response);
				res.status(200).json({ success: true, class_name: chat_room_name });
			})
			.catch((err) => {
				console.log('Create Class error: ', err);
				res.status(400).json({ success: false, error: err });
			});
		const text = `
		INSERT INTO classes (created_at, status, instructor_name, chat_room_name, total_spots, instructor_id)
		values($1, $2, $3, $4, $5, (Select user_id from users WHERE user_id = 1))
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
				res.status(200).json({ success: true, class_name: chat_room_name });
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

// used to find games played and correct answers
classesControler.getClasses = (req, res, next) => {
	const text = `
        SELECT chat_room_name, class_id
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

classesControler.endClass = (req, res, next) => {
	const liveTime = time.getTime();
	// participants and insturctor id can be null right now for MVP
	const { class_id } = req.body;
	console.log('req.body: ', req.body);
	const text = `
	UPDATE classes
	SET updated_at = $1, status = 'closed'
	WHERE class_id = '${class_id}'
`;
	const values = [liveTime];
	db.query(text, values)
		.then((response) => {
			res.status(200).json({ success: true });
		})
		.catch((err) => console.log(err));
	next();
};

module.exports = classesControler;
