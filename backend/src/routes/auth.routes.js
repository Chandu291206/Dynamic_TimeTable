const router = require('express').Router();
const controller = require('../controllers/auth.controller');
const { authenticateJWT } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

router.post('/login', authLimiter, controller.login);
router.post('/cr/login', authLimiter, controller.login);
router.post('/admin/login', authLimiter, controller.login);
router.post('/logout', controller.logout);
router.get('/me', authenticateJWT, controller.me);

module.exports = router;
