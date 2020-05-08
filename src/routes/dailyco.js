const express = require('express');
const dailyco = express.Router();
const dailycoController = require('../controllers/dailycoController');

dailyco.get('/room', dailycoController.getRoom, (req, res) => {});

// TODO test this works
dailyco.delete('/room', dailycoController.deleteRoom, (req, res) => {});

dailyco.post('/room', dailycoController.createRoom, (req, res) => {});

dailyco.post('/token', dailycoController.createToken, (req, res) => {});

module.exports = dailyco;
