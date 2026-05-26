// series.routes.js
const router = require('express').Router();
const auth = require('../middleware/auth.middleware');
const c = require('../controllers/series.controller');

router.get('/popular', auth, c.getPopular);
router.get('/search', auth, c.search);
router.get('/trending', auth, c.getTrending);
router.get('/genre', auth, c.getByGenre);
router.get('/:id', auth, c.getDetail);
router.get('/:id/season/:seasonNumber', auth, c.getSeasonDetail);

module.exports = router;
