const express = require('express');
const router = express.Router();
const controller = require('../controllers/financeControllers');
const { verifyJWT, requireFinance } = require('../lib/middleware');

const guard = [verifyJWT, requireFinance];

router.get('/dashboard', guard, controller.getFinanceDashboard);
router.get('/queue', guard, controller.getFinanceQueue);

router.get('/invoices', guard, controller.getInvoices);
router.post('/invoices', guard, controller.createInvoiceFromDelivery);
router.get('/invoices/:id', guard, controller.getInvoiceById);
router.put('/invoices/:id', guard, controller.updateInvoice);
router.get('/invoices/:id/pdf', guard, controller.downloadInvoicePdf);
router.post('/invoices/:id/fbr/validate', guard, controller.validateInvoiceWithFbr);
router.patch('/invoices/:id/issue', guard, controller.issueInvoice);
router.patch('/invoices/:id/cancel', guard, controller.cancelInvoice);

router.get('/reports', guard, controller.getFinanceReport);
router.get('/reports/excel', guard, controller.downloadFinanceReport);

router.get('/fbr/config', guard, controller.getFbrConfig);
router.get('/fbr/scenarios', guard, controller.getFbrScenarios);
router.post('/fbr/scenarios/:id/run', guard, controller.runFbrScenario);
router.get('/fbr/submissions', guard, controller.getFbrSubmissions);
router.get('/fbr/reference/:name', guard, controller.getFbrReference);
router.get('/fbr/buyer-registration', guard, controller.checkBuyerRegistration);

module.exports = router;
