const router = require('express').Router();
const auth = require('../middleware/auth.middleware');
const c = require('../controllers/settings.controller');

router.get('/:key', c.getSetting);
router.put('/:key', auth, c.updateSetting);

module.exports = router;
