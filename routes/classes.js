const express = require('express');
const classes = express.Router();

const classesController = require('../controller/classesController');

classes.get('/', classesController.getClasses, (req, res) => {});

classes.post('/', classesController.createClass, (req, res) => {});

classes.put('/endClass', classesController.endClass, (req, res) => {});

classes.put('/loadClass', classesController.loadClass, (req, res) => {});

classes.put(
	'/refreshActive',
	classesController.checkExpiredClasses,
	(req, res) => {}
);

classes.put(
	'/delete/active',
	classesController.wipeActiveClasses,
	(req, res) => {}
);

classes.put(
	'/delete/closed',
	classesController.wipeClosedClasses,
	(req, res) => {}
);

module.exports = classes;
