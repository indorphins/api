const express = require('express');
const classes = express.Router();

const classesController = require('../controller/classesController');

classes.get('/', classesController.getClasses, (req, res) => {
	console.log('classes GET');
});

classes.post('/', classesController.createClass, (req, res) => {
	console.log('classes POST Created');
});

classes.put('/', classesController.endClass, (req, res) => {
	console.log('classes PUT Created')
})

module.exports = classes;
