const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const { myVerified } = require('../controllers/debug.controller');

router.get('/me/verified', auth, myVerified);

module.exports = router;
