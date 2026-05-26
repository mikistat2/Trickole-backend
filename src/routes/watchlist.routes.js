const router = require('express').Router();
const auth = require('../middleware/auth.middleware');
const c = require('../controllers/watchlist.controller');

router.get('/', auth, c.getWatchlist);
router.post('/', auth, c.addToWatchlist);
router.patch('/:id/status', auth, c.updateStatus);
router.delete('/:id', auth, c.removeFromWatchlist);

module.exports = router;
