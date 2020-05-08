const express = require('express');
const classes = express.Router();

const classController = require('../mongoControllers/classController');

classes.get('', classController.getClasses, (req, res) => {
	res.send('Hello ACtive classes');
});

classes.get('/id/:id', classController.getClass);

classes.get('/scheduled', classController.getScheduledClasses);

classes.get('/', classController.getClasses);

classes.delete('/:id', classController.deleteClass);

classes.post('/', classController.createClass);

classes.put('/end/:id', classController.endClass);

classes.put('/update/:id', classController.updateClass);

classes.put('/cancel/:id', classController.cancelClass);

module.exports = classes;
