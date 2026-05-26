const router = require('express').Router();
const auth = require('../middleware/auth.middleware');
const c = require('../controllers/room.controller');

router.get('/', auth, c.getMyRooms);
router.post('/', auth, c.createRoom);
router.post('/join', auth, c.joinRoom);
router.get('/:id', auth, c.getRoomDetail);
router.delete('/:id/leave', auth, c.leaveRoom);

module.exports = router;
