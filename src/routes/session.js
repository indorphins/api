const express = require('express');
const router = express.Router();
const middleware = require('../middleware');
const session = require('../handlers/session');

router.patch('/:classId/:sessionId', middleware.authentication);
router.patch('/:classId/:sessionId', session.updateSession);

router.get('/:classId/:sessionId', middleware.authentication);
router.get('/:classId/:sessionId', session.getSession)

router.post('/:classId/:sessionId', middleware.authentication);
router.post('/:classId/:sessionId', session.createSession);

router.delete('/:classId/:sessionId', middleware.authentication);
router.delete('/:classId/:sessionId', session.deleteSession);

router.get('', middleware.authentication);
router.get('', session.getAllSessions);

module.exports = router;
