const router = require('express').Router();
const { body } = require('express-validator');
const auth = require('../middleware/auth.middleware');
const { register, login, getMe, googleLogin } = require('../controllers/auth.controller');

router.post('/register',
  body('username').trim().isLength({ min: 3, max: 30 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  register
);

router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  login
);

router.get('/me', auth, getMe);

router.post('/google',
  body('credential').notEmpty(),
  googleLogin
);

module.exports = router;
