const express = require('express');
// const contactControllers = require('../controllers/contactControllers.js');
const dealControllers = require('../controllers/dealsControllers.js');
const { verifyJWT, requireAdmin } = require('../lib/middleware.js');
const router = express.Router();

router.post('/create', verifyJWT, dealControllers.createDeal);
router.get('/my', verifyJWT, dealControllers.getMyDeals);
router.put('/stage/:id', verifyJWT, dealControllers.updateDealStage);

// Admin Routes
router.get('/all', verifyJWT, requireAdmin, dealControllers.getAllDeals);

module.exports = router;
