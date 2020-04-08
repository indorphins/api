const express = require('express');
const login = express.Router();

const userModelController = require('../controller/userModelController');

login.post('/', userModelController.findUser, (req, res) => {
	console.log('Login POST');
});

login.get('/index.css', (req, res) => {
	console.log('Login GET css');
	// res.status(200).sendFile(path.resolve(__dirname, '../../client/index.css'))
});

module.exports = login;
