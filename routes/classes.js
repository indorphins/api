const express = require('express');
const classes = express.Router();
const path = require('path');

const classesControler = require('../controller/classesController.js');

classes.get('/', classesControler.getClasses, (req, res) => {
  console.log('classes GET')
});

classes.post('/', classesControler.createClasses, (req, res) => {
  console.log('classes POST Created')
});

module.exports = classes;
