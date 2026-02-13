const express = require('express');
const {
	createInvoice,
	getInvoices,
	updateInvoice,
	issueInvoice,
	cancelInvoice,
	deleteInvoice,
	generateInvoicePdf,
} = require('../controllers/invoiceControllers');
const { verifyJWT, requireAdmin } = require('../lib/middleware.js');
const router = express.Router();

router.post('/create', verifyJWT, requireAdmin, createInvoice);
router.get('/get', verifyJWT, requireAdmin, getInvoices);
router.get('/:id/pdf', generateInvoicePdf);
router.put('/update/:id', verifyJWT, requireAdmin, updateInvoice);

router.patch('/issue/:id', verifyJWT, requireAdmin, issueInvoice);

router.patch('/cancel/:id', verifyJWT, requireAdmin, cancelInvoice);
router.delete('/delete/:id', verifyJWT, requireAdmin, deleteInvoice);

module.exports = router;
