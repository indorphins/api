const express = require('express');
const firebase = require('../auth');
const middleware = require('../middleware');
const user = require('../handlers/user');

let router = express.Router();
router.post('/', middleware.authentication);
router.post('/', middleware.adminAuthorized);
router.post('/', user.createUser);

router.get('/:id', middleware.authentication);
router.get('/:id', middleware.adminAuthorized);
router.get('/:id', user.getUser);

router.delete('/:id', middleware.authentication);
router.delete('/:id', middleware.adminAuthorized);
router.delete('/:id', user.deleteUser);

router.put('/:id', middleware.authentication);
router.put('/:id', middleware.adminAuthorized);
router.put('/:id', user.updateUser);

router.get('/login', (req, res) => {
	firebase
		.verifyFirebaseToken(req, res)
		.then((firebaseUid) => {
			req.params.firebaseUid = firebaseUid;
			user.loginUser(req, res);
		})
		.catch((error) => {
			console.log('/login error: ', error);
			res.status(400).send();
		});
});

module.exports = router;
