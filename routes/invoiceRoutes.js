const express = require('express');
const {
	generateInvoicePdf,
	generateDeliveryNotePdf,
} = require('../controllers/invoiceControllers');
const { verifyJWT, requireAdmin } = require('../lib/middleware.js');
const router = express.Router();

router.get('/:id/pdf', generateInvoicePdf);
router.get('/:id/deliveryNote', generateDeliveryNotePdf);

module.exports = router;
