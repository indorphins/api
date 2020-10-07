const express = require('express');
const router = express.Router();
const middleware = require('../middleware');
const session = require('../handlers/session');
const opentok = require('../handlers/opentok');

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

router.post('/archive', middleware.authentication);
router.post('/archive', opentok.fetchArchives);

router.get('/:instructorId', middleware.authentication);
router.get('/:instructorId', session.getInstructorSessions);

router.put('/archive/:id', middleware.authentication);
router.put('/archive/:id', opentok.startArchive);

module.exports = router;
