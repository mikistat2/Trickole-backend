// leaderboard.routes.js
const router = require('express').Router();
const auth = require('../middleware/auth.middleware');
const c = require('../controllers/leaderboard.controller');

router.get('/global', auth, c.getGlobal);
router.get('/me', auth, c.getMyStats);
router.get('/room/:roomId', auth, c.getRoomLeaderboard);

module.exports = router;
