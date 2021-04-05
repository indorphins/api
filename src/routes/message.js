const express = require('express');
const router = express.Router();
const middleware = require('../middleware');
const messageHandlers = require('../handlers/message');

router.post('/:id/joined', middleware.authentication);
router.post('/:id/joined', messageHandlers.classJoined);

router.post('/accountCreated', middleware.authentication);
router.post('/accountCreated', messageHandlers.accountCreated)

module.exports = router;
