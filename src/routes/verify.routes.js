const router = require('express').Router();
const auth = require('../middleware/auth.middleware');
const c = require('../controllers/verify.controller');

router.post('/generate', auth, c.generateQuiz);
router.post('/submit', auth, c.submitAnswers);

module.exports = router;
