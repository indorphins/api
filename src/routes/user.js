const express = require('express');
const firebase = require('../auth');
const middleware = require('../middleware');
const user = require('../handlers/user');

let router = express.Router();
router.post('/', middleware.authentication);
router.post('/', user.createUser);

router.get('/', middleware.authentication);
router.get('/', user.getUser);

router.get('/:id', middleware.authentication);
router.get('/:id', middleware.adminAuthorized);
router.get('/:id', user.getUser);

router.delete('/', middleware.authentication);
router.delete('/', user.deleteUser);

router.delete('/:id', middleware.authentication);
router.delete('/:id', middleware.adminAuthorized);
router.delete('/:id', user.deleteUser);

router.put('/', middleware.authentication);
router.put('/', user.updateUser);

router.put('/:id', middleware.authentication);
router.put('/:id', middleware.adminAuthorized);
router.put('/:id', user.updateUser);

module.exports = router;
