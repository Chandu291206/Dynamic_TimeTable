const router = require('express').Router();
const controller = require('../controllers/faculty-portal.controller');
const { authenticateJWT, requireFaculty } = require('../middleware/auth');

router.use(authenticateJWT, requireFaculty);
router.get('/dashboard', controller.dashboard);
router.post('/scrape-profile', controller.scrapeMyProfile);

module.exports = router;
