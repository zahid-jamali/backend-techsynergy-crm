const express = require('express');
const router = express.Router();
const controller = require('../controllers/salesTargetControllers.js');

router.post('/upsert', controller.upsertMonthlyTarget);
router.get('/monthly/:userId', controller.getUserMonthlyTarget);
router.get('/user/:userId', controller.getUserTargets);
router.delete('/:id', controller.deleteMonthlyTarget);
router.get('/get', controller.getTargets);
router.get('/team-summary', controller.getTeamMonthlySummary);

module.exports = router;
