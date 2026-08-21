const express = require('express');

const quoteControllers = require('../controllers/quoteControllers.js');
const { verifyJWT, requireAdmin } = require('../lib/middleware.js');
const uploadPO = require('../lib/poUpload.js');
const router = express.Router();

router.post('/create', verifyJWT, quoteControllers.createQuote);
router.get('/my', verifyJWT, quoteControllers.getMyQuotes);
router.get('/:id/costing-sheet', verifyJWT, quoteControllers.generateCostingSheet);
router.get('/:id/pdf', quoteControllers.generateQuotePdf);
router.put('/update/:id', verifyJWT, quoteControllers.updateQuote);
router.patch('/:id/archive', verifyJWT, quoteControllers.archiveQuote);
router.put(
	'/:id/updateStage',
	verifyJWT,
	uploadPO.single('purchaseOrder'),
	quoteControllers.updateQuoteStage
);

// Admin Routes
router.get('/all', verifyJWT, requireAdmin, quoteControllers.getAllQuotes);

module.exports = router;
