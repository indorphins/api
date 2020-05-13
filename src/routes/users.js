const express = require('express');
const users = express.Router();

const userController = require('../controllers/userController');

users.delete('/:id', userController.deleteUser);

users.post('/', userController.createUser);

users.get('/', userController.getUsers);

users.get('/login/:token', userController.loginUser);

users.get('/user/:id', userController.getUser);

users.put('/update/:id', userController.updateUser);

users.put('/addClass/:token', userController.addClassForId);

users.get('/getScheduledClasses/:token', userController.getScheduledClassForId);

module.exports = users;
