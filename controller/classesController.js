const db = require('../data/userModel');
const fetch = require('node-fetch');

const classesControler = {};

function getTime() {
	var mySqlTimestamp = Date.now();
	var date = new Date(mySqlTimestamp);
	return date;
}

classesControler.createClass = (req, res, next) => {
	const liveTime = getTime();
	// participants and insturctor id can be null right now for MVP
	const { status, instructor_name, chat_room_name, total_spots } = req.body;
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

// TODO only async call here, why?
classesControler.endClass = async (req, res, next) => {
	const liveTime = getTime();
	// participants and insturctor id can be null right now for MVP
	const { class_id } = req.body;
	console.log('req.body: ', req.body);
	const text = `
	UPDATE classes
	SET updated_at = '${liveTime}', status = 'closed'
	WHERE class_id = '${class_id}'
`;
	db.query(text)
		.then((response) => console.log(response))
		.catch((err) => console.log(err));
	next();
};

module.exports = classesControler;
