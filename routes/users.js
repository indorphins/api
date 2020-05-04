const express = require('express');
const users = express.Router();

const userController = require('../mongoControllers/userController');

users.delete('/:id', userController.deleteUser);

users.post('/', userController.createUser);

users.get('/', userController.getUsers);

users.get('/:id', userController.getUser);

users.put('/:id', userController.updateUser);

module.exports = users;
