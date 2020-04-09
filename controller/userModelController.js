const db = require('../data/userModel');
const fetch = require('node-fetch');
const time = require('../utils/getTime');

const userModelController = {};


userModelController.getAllParticipants = (req, res, next) => {
	const text = `
	SELECT * FROM public.users WHERE user_type = '0'
	`;
	db.query(text)
		.then((response) => {
			console.log('Create User success');
			res.status(200).json({ success: true, participants: response.rows });
		})
		.catch((err) => {
			console.log('Create User error', err);
			res.status(400).json({ success: false, error: err });
		});

	next();
};

userModelController.getAllInstructors = (req, res, next) => {
	const text = `
	SELECT * FROM public.users WHERE user_type = '1'
	`;
	db.query(text)
		.then((response) => {
			console.log('Create User success');
			res.status(200).json({ success: true, participants: response.rows });
		})
		.catch((err) => {
			console.log('Create User error', err);
			res.status(400).json({ success: false, error: err });
		});

	next();
};

//action whenever a new user signs up
userModelController.createUser = (req, res, next) => {
	const liveTime = time.getTime();
	console.log('THIS IS DATE', liveTime);
	const {
		first_name,
		last_name,
		email,
		password,
		phone_number,
		user_type,
	} = req.body;
	const text = `
            INSERT INTO users (created_at, first_name, last_name, email, password, phone_number, user_type)
            values($1, $2, $3, $4, $5, $6, $7)
        `;
	const values = [
		liveTime,
		first_name,
		last_name,
		email,
		password,
		phone_number,
		user_type,
	];

	// TODO validate email is not taken, if possible make db throw error for trying to duplicate unique key?
	// res.status(400).json({success: false, error: 'email_taken'})

	db.query(text, values)
		.then((response) => {
			console.log('Create User success');
			res.status(200).json({ success: true });
		})
		.catch((err) => {
			console.log('Create User error', err);
			res.status(400).json({ success: false, error: err });
		});

	next();
};

//used for login verification
userModelController.findUser = (req, res, next) => {
	const { username, password } = req.body;
	console.log('user / pass : ', username, password);
	const text = `
            SELECT email, first_name, last_name, phone_number, user_type
            FROM users
            WHERE email = '${username}' AND password = '${password}'

    `;
	// const values = [username, password];
	db.query(text)
		.then((response) => {
			console.log('Login got ', response);
			//if the user doesn't exist or username/password is incorrect
			if (response.rows[0]) {
				console.log(
					'User ',
					response.rows[0].username,
					' has been verified through SQL DB'
				);
				// TODO only return needed fields (not password)
				res.status(200).json({ success: true, user: response.rows[0] });
				next();
			} else {
				console.log('Username or password is invalid.');
				res.status(400).json({ success: false, error: 'invalid_credentials' });
			}
		})
		.catch((err) => {
			console.log('Find User error ', err);
			res.status(400).json({ success: false, error: err });
		});
};


module.exports = userModelController;
