const express = require('express');

const dashboardControllers = require('../controllers/dashboardControllers');
const { verifyJWT, requireAdmin } = require('../lib/middleware.js');
const router = express.Router();

// router.post('/create', verifyJWT, quoteControllers.createQuote);

router.get('/staff', verifyJWT, dashboardControllers.getDashboardData);

module.exports = router;
