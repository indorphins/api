const db = require('../data/userModel');
const fetch = require('node-fetch');

const userModelController = {};

function getTime() {
	var mySqlTimestamp = Date.now();
	var date = new Date(mySqlTimestamp);
	return date;
}

//action whenever a new user signs up
userModelController.createUser = (req, res, next) => {
	const liveTime = getTime();
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
			console.log('Create User error', typeof err, ' ', err);
			let errMsg = { success: false, error: err };
			if (err.constraint === 'users_email_key') {
				errMsg = { success: false, error: 'duplicate_email' };
			}
			if (err.constraint === 'users_phone_number_key') {
				errMsg = { success: false, error: 'duplicate_phone' };
			}
			res.status(400).json(errMsg);
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

// used to find games played and correct answers
userModelController.findStats = (req, res, next) => {
	const text = `
        SELECT games_played, correct_answers
        FROM users
        WHERE username = '${req.params.username}'
    `;
	db.query(text)
		.then((response) => {
			if (response.rows[0]) {
				console.log(
					'User ',
					req.params.username,
					' Games played: ',
					response.rows[0].games_played,
					' Correct answers: ',
					response.rows[0].correct_answers
				);
				res.locals.stats = response.rows[0];
				next();
			} else {
				console.log('Error occurred. Username is not sending properly.');
				res.send('Error occurred. Username is not sending properly.');
			}
		})
		.catch((err) => console.log(err));
};

userModelController.questions = async (req, res, next) => {
	const url = 'https://opentdb.com/api.php?amount=10&category=9&type=multiple';
	await fetch(url)
		.then((response) => response.json())
		.then((data) => {
			res.locals.results = data.results;
		})
		.catch((err) => console.log(err));
	next();
};

// used for when a user wants to update their information -- stretch feature?
userModelController.updateUser = async (req, res, next) => {
	const { username, correctAnswers } = req.body;
	const text1 = `
        SELECT games_played, correct_answers
        FROM users
        WHERE username = '${username}'
    `;

	await db
		.query(text1)
		.then((response) => (res.locals.updatedStats = response.rows[0]))
		.catch((err) => console.log(err));

	res.locals.games_played = res.locals.updatedStats.games_played + 1;
	res.locals.correct_answers =
		res.locals.updatedStats.correct_answers + correctAnswers;

	const text2 = `
        UPDATE users
        SET games_played = '${res.locals.games_played}', correct_answers = '${res.locals.correct_answers}'
        WHERE username = '${username}'
    `;
	// const values = [username, password, age];

	await db
		.query(text2)
		.then((response) => console.log(response))
		.catch((err) => console.log(err));

	next();
};

userModelController.deleteUser = async (req, res, next) => {
	const { username } = req.body;
	const text = `
        DELETE FROM users
        WHERE username = '${username}'
    `;
	await db
		.query(text)
		.then((response) => console.log(`${username} has been deleted`))
		.catch((err) => console.log(err));
	next();
};

module.exports = userModelController;
