const db = require('../data/userModel');
const fetch = require('node-fetch');
// function to get timestamp of current time (formated to send to db)
const time = require('../utils/getTime');

const userModelController = {};

// Contorller to get all participant users
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

// Contorller to get all instructors
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

// action whenever a new user signs up - stored in users Table
// email && phone number must be unique
userModelController.createUser = async (req, res, next) => {
	// check to see if phone number is proper format
	if (req.body.phone_number.length === 10) {
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
		const text1 = `
		INSERT INTO users (created_at, first_name, last_name, email, password, phone_number, user_type)
		values($1, $2, $3, $4, $5, $6, $7)
		RETURNING user_id, created_at, first_name, last_name, email, phone_number, user_type
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

		// on client side have the phone input box be formated as ###-###-#### but send back with only numbers
		// db will throw error if phone number is more than 10 char

		db.query(text1, values)
			.then((response) => {
				console.log('Create User success');
				res.status(200).json({ success: true, user: response.rows });
			})
			.catch((err) => {
				console.log('Create User error', err);
				let errMsg = { success: false, error: err };
				if (err.constraint === 'users_email_key') {
					errMsg = { success: false, error: 'duplicate_email' };
				}
				if (err.constraint === 'users_phone_number_key') {
					errMsg = { success: false, error: 'duplicate_phone' };
				}
				res.status(400).json(errMsg);
			});
	} else {
		res.status(400).json({ success: false, error: 'invalid phone number' });
	}

	next();
};

// used for login verification
// email or phone number maybe used for verification (if phone number to be used swap email with phone_number)
userModelController.findUser = (req, res, next) => {
	const { email, password } = req.body;
	console.log('user / pass : ', email, password);
	const text = `
            SELECT email, first_name, last_name, phone_number, user_type
            FROM users
            WHERE email = '${email}' AND password = '${password}'

    `;
	db.query(text)
		.then((response) => {
			console.log('Login got ', response);
			//if the user doesn't exist or email/password is incorrect
			if (response.rows[0]) {
				console.log(
					'User ',
					response.rows[0].email,
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

// NOTE: all values will be updated (undefined varibales with update db as undefined)
// email and phone number cannot be updated (will be a sepereate controller)
// another way to do this is to have a conditional for each undefined var get its value and then store that undefined value and then update it with that value
userModelController.updateUser = (req, res, next) => {
	const { user_id, first_name, last_name, password, email } = req.body;
	if (first_name === undefined || last_name === undefined || password === undefined) {
		console.log('A variable returned undefined')
	}
	else {
		console.log('this is Updated', req.body)
		const text = `
			UPDATE users
			SET first_name = '${first_name}', last_name = '${last_name}', password = '${password}'
			WHERE email = '${email}'
			RETURNING user_id, created_at, first_name, last_name, email, phone_number, user_type
			`;
		db.query(text)
			.then((response) => {
				res.status(200).json({ success: true, user: response.rows });
			})
			.catch((err) => {
				res.status(400).json({ success: false, error: err });
			});
	}

	next();
};

module.exports = userModelController;
