const router = require('express').Router();
const controller = require('../controllers/public.controller');

router.get('/classes', controller.getClasses);
router.get('/timetable/:classId/weekly', controller.getWeeklyTimetable);
router.get('/timetable/:classId/json', controller.getTimetableJson);
router.get('/timetable/:classId', controller.getTimetable);
router.get('/faculty/:id/image', controller.getFacultyImage);

module.exports = router;
