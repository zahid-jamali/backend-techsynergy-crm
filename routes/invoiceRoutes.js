const express = require('express');
const {
	generateInvoicePdf,
	generateDeliveryNotePdf,
	addInvoiceTermsAndConditions
} = require('../controllers/invoiceControllers');
const { verifyJWT, requireAdmin } = require('../lib/middleware.js');
const router = express.Router();

router.get('/:id/pdf', generateInvoicePdf);
router.get('/:id/deliveryNote', generateDeliveryNotePdf);
router.put('/terms', verifyJWT, requireAdmin, addInvoiceTermsAndConditions)

module.exports = router;
