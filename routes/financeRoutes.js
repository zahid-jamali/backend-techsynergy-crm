const express = require('express');
const router = express.Router();
const controller = require('../controllers/financeControllers');
const { verifyJWT, requireFinance } = require('../lib/middleware');

router.get('/dashboard', verifyJWT, requireFinance, controller.getFinanceDashboard);
router.get('/queue', verifyJWT, requireFinance, controller.getFinanceQueue);
router.get('/invoices', verifyJWT, requireFinance, controller.getInvoices);
router.post('/invoices', verifyJWT, requireFinance, controller.createInvoiceFromDelivery);
router.patch('/invoices/:id/issue', verifyJWT, requireFinance, controller.issueInvoice);
router.patch('/invoices/:id/cancel', verifyJWT, requireFinance, controller.cancelInvoice);
router.get('/reports', verifyJWT, requireFinance, controller.getFinanceReport);
router.get('/reports/excel', verifyJWT, requireFinance, controller.downloadFinanceReport);

module.exports = router;
