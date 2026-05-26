const router = require('express').Router();
const auth = require('../middleware/auth.middleware');
const c = require('../controllers/user.controller');

router.get('/history', auth, c.getWatchHistory);
router.get('/:username', c.getProfile);

module.exports = router;
