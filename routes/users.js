const express = require('express');
const users = express.Router();

const userController = require('../mongoControllers/userController');

users.delete('/:id', userController.deleteUser);

users.post('/', userController.createUser);

users.get('/', userController.getUsers);

users.post('/login', userController.loginUser);

users.get('/user/:id', userController.getUser);

users.put('/update/:id', userController.updateUser);

users.put('/addClass/:id', userController.addClassForId);

users.get('/getScheduledClasses/:id', userController.getScheduledClassForId);

module.exports = users;
