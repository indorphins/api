const express = require('express');
const dailyco = express.Router();
const dailycoController = require('../controller/dailycoController');

dailyco.get('/room', dailycoController.getRoom, (req, res) => {
	console.log('router get room returns');
	res.status(200).send();
});

// TODO test this works
dailyco.delete('/room', dailycoController.deleteRoom, (req, res) => {
	console.log('router delete room returns');
	res.status(200).send();
});

dailyco.post('/room', dailycoController.createRoom, (req, res) => {
	console.log('router create room returns');
	res.status(200).send();
});

dailyco.post('/token', dailycoController.createToken, (req, res) => {
	console.log('router create token returns');
	res.status(200).send();
});

module.exports = dailyco;
