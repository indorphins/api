const express = require('express');
const router = express.Router();
const middleware = require('../middleware');
const opentok = require('../handlers/opentok');

router.post('', middleware.authentication);
router.post('', opentok.fetchArchives);

router.put('/:id', middleware.authentication);
router.put('/:id', opentok.startArchive);

router.delete('/:id', middleware.authentication);
router.delete('/:id', opentok.stopArchive);

module.exports = router;
