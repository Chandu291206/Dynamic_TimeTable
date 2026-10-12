const router = require('express').Router();
const controller = require('../controllers/cr.controller');
const { authenticateJWT, requireCR } = require('../middleware/auth');

router.use(authenticateJWT, requireCR);
router.get('/me', (req, res) => res.json({ success: true, data: { user: req.user } }));
router.get('/dashboard', controller.dashboard);
router.get('/overrides', controller.upcomingOverrides);
router.post('/overrides', controller.createOverride);
router.delete('/overrides/:id', controller.deleteOverride);

module.exports = router;
