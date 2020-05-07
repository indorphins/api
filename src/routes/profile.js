const express = require('express');
const path = require('path');
const profile = express.Router();

const userModelController = require('../controller/userModelController');

// profile.get('/profile.css', (req, res) => {
// 	console.log('profile GET css');
// 	// res.status(200).sendFile(path.resolve(__dirname, '../../client/signup.css'));
// });

profile.put('/', userModelController.updateUser, (req, res) => {
  console.log('Updated PUT')
  res.status(200)
});

module.exports = profile;