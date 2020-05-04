const express = require('express');
const login = express.Router();

const userModelController = require('../controller/userModelController');

// login verification via email (phone number maybe be changed in controller)
login.post('/', userModelController.findUser, (req, res) => {
	console.log('Login POST');
	res.status(200);
});

// login.get('/index.css', (req, res) => {
// 	console.log('Login GET css');
// 	res.status(200).sendFile(path.resolve(__dirname, '../../client/index.css'))
// });

// gets list of all instructors
// to get list of all users swtich with getAllParticipants
login.get('/users', userModelController.getAllInstructors, (req, res) => {
	console.log('Login GET USERS');
	res.status(200);
});

module.exports = login;
