const db = require('../data/userModel');
const fetch = require('node-fetch');
<<<<<<< HEAD

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
  console.log('req.body: ', req.body);
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
    .then(response => console.log(response))
    .catch(err => console.log(err));
  next()

};

// used to find games played and correct answers
classesControler.getClasses = (req, res, next) => {
  const text = `
        SELECT chat_room_name, class_id
        FROM classes
        WHERE status = 'active'
    `;
  db.query(text)
    .then(response => console.log(response))
    .catch(err => console.log(err));
  next()
};

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
    .then(response => console.log(response))
    .catch(err => console.log(err));
  next()

};


module.export = classesControler;
=======
// function to get timestamp of current time (formated to send to db)
const time = require('../utils/getTime');

const classesControler = {};

// create a class (currently set to active when classs is created)
// TODO add duration field to initializer and return value
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
		});

		const text = `
		INSERT INTO classes (created_at, status, instructor_name, chat_room_name, total_spots, instructor_id)
		values($1, $2, $3, $4, $5, (Select user_id from users WHERE user_id = ${user_id}))
		RETURNING created_at, status, instructor_name, chat_room_name, total_spots, instructor_id
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

module.exports = classesControler;
>>>>>>> updated
