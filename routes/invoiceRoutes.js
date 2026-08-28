const express = require('express');
const {
	generateInvoicePdf,
	generateDeliveryNotePdf,
	addInvoiceTermsAndConditions
} = require('../controllers/invoiceControllers');
const { verifyJWT, requireFinance, requireRoles } = require('../lib/middleware.js');
const router = express.Router();

const invoiceDownloadRoles = requireRoles('admin', 'operations', 'finance');
const deliveryNoteDownloadRoles = requireRoles('admin', 'operations');

router.get('/:id/pdf', verifyJWT, invoiceDownloadRoles, generateInvoicePdf);
router.get(
	'/:id/deliveryNote',
	verifyJWT,
	deliveryNoteDownloadRoles,
	generateDeliveryNotePdf
);
router.put('/terms', verifyJWT, requireFinance, addInvoiceTermsAndConditions);

module.exports = router;
