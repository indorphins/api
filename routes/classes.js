const express = require('express');
const classes = express.Router();

const classController = require('../mongoControllers/classController');

classes.get('', classController.getClasses, (req, res) => {
	res.send('Hello ACtive classes');
});

classes.get('/:id', classController.getClass, (req, res) => {});

// classes.get(
// 	'/scheduled',
// 	classesController.getScheduledClassesForUser,
// 	(req, res) => {}
// );

// classes.get(
// 	'/closed',
// 	classesController.getClosedClassesForUser,
// 	(req, res) => {}
// );

classes.delete('/:id', classController.deleteClass, (req, res) => {});

classes.post('/', classController.createClass, (req, res) => {});

classes.put('/endClass', classController.updateClass, (req, res) => {});

classes.put('/:id', classController.updateClass, (req, res) => {});

classes.put('/loadClass', classController.updateClass, (req, res) => {});

// classes.put(
// 	'/refreshActive',
// 	classesController.checkExpiredClasses,
// 	(req, res) => {}
// );

// classes.put(
// 	'/delete/active',
// 	classesController.wipeActiveClasses,
// 	(req, res) => {}
// );

// classes.put(
// 	'/delete/closed',
// 	classesController.wipeClosedClasses,
// 	(req, res) => {}
// );

module.exports = classes;
