const express = require('express');
const users = express.Router();
const firebase = require('../controllers/firebaseController');
const userController = require('../controllers/userController');

users.delete('/:id', userController.deleteUser);

users.post('/', userController.createUser);

users.get('/', userController.getUsers);

users.get('/login', (req, res) => {
	firebase
		.verifyFirebaseToken(req, res)
		.then((firebaseUid) => {
			req.params.firebaseUid = firebaseUid;
			userController.loginUser(req, res);
		})
		.catch((error) => {
			console.log('/login error: ', error);
			res.status(400).send();
		});
});

users.get('/user/:id', userController.getUser);

users.put('/update/:id', userController.updateUser);

users.put('/addClass', (req, res) => {
	firebase
		.verifyFirebaseToken(req, res)
		.then((firebaseUid) => {
			req.params.firebaseUid = firebaseUid;
			userController.addClassForId(req, res);
		})
		.catch((error) => {
			console.log('/login error: ', error);
			res.status(400).send();
		});
});

users.get('/getScheduledClasses', (req, res) => {
	firebase
		.verifyFirebaseToken(req, res)
		.then((firebaseUid) => {
			req.params.firebaseUid = firebaseUid;
			userController.getScheduledClassForId(req, res);
		})
		.catch((error) => {
			console.log('/login error: ', error);
			res.status(400).send();
		});
});

module.exports = users;
