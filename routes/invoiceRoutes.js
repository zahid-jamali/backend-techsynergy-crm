const express = require('express');
const {
	generateInvoicePdf,
	generateDeliveryNotePdf,
	addInvoiceTermsAndConditions
} = require('../controllers/invoiceControllers');
const { verifyJWT, requireFinance } = require('../lib/middleware.js');
const router = express.Router();

router.get('/:id/pdf', generateInvoicePdf);
router.get('/:id/deliveryNote', generateDeliveryNotePdf);
router.put('/terms', verifyJWT, requireFinance, addInvoiceTermsAndConditions);

module.exports = router;
