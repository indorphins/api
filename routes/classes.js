const express = require('express');
const classes = express.Router();

const classesController = require('../controller/classesController');
// get active list of classes route 
classes.get('/', classesController.getClasses, (req, res) => {
	console.log('classes GET');
	res.status(200);
});
// create class route
classes.post('/', classesController.createClass, (req, res) => {
	console.log('classes POST Created');
	res.status(200);
});
// end class route 
classes.put('/', classesController.endClass, (req, res) => {
	console.log('classes PUT Created');
	res.status(200);
})

module.exports = classes;
