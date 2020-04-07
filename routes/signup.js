const express = require('express');
const signup = express.Router();
const path = require('path');

const userModelController = require('../controller/userModelController');

signup.get('/', (req, res) => {
	console.log('signup GET');
	// res.status(200).sendFile(path.resolve(__dirname, '../../client/signup.html'));
});

signup.get('/signup.css', (req, res) => {
	console.log('signup GET css');
	// res.status(200).sendFile(path.resolve(__dirname, '../../client/signup.css'))
});

signup.post('/', userModelController.createUser, (req, res) => {
	console.log('signup POST');
	// res.status(200).redirect('/');
});

module.exports = signup;
