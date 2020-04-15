const express = require('express');
const classes = express.Router();

const classesController = require('../controller/classesController');

classes.get('/', classesController.getClasses, (req, res) => {});

classes.post('/', classesController.createClass, (req, res) => {});

classes.put('/', classesController.endClass, (req, res) => {});

module.exports = classes;
