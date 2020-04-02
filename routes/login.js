const express = require('express');
const login = express.Router();
const path = require('path');

login.get('/', (req, res) => {
	console.log('Login GET');
	// res.status(200).sendFile(path.resolve(__dirname, '../../client/index.html'))
});

login.get('/index.css', (req, res) => {
	console.log('Login GET css');
	// res.status(200).sendFile(path.resolve(__dirname, '../../client/index.css'))
});

module.exports = login;
