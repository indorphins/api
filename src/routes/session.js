const express = require('express');
const router = express.Router();
const middleware = require('../middleware');
const session = require('../handlers/session');

router.put('/:classId/:sessionId', middleware.authentication);
router.put('/:classId/:sessionId', session.updateSession);

router.get('/:classId/:sessionId', middleware.authentication);
router.get('/:classId/:sessionId', session.getSession)

router.post('/:classId/:sessionId', middleware.authentication);
router.post('/:classId/:sessionId', session.createSession);

router.delete('/:classId/:sessionId', middleware.authentication);
router.delete('/:classId/:sessionId', session.deleteSession);

module.exports = router;
