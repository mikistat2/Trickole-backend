// movie.routes.js
const router = require('express').Router();
const auth = require('../middleware/auth.middleware');
const c = require('../controllers/movie.controller');

router.get('/popular', auth, c.getPopular);
router.get('/search', auth, c.search);
router.get('/trending', auth, c.getTrending);
router.get('/genre', auth, c.getByGenre);
router.post('/recommend', auth, c.recommend);
router.get('/:id', auth, c.getDetail);

module.exports = router;
