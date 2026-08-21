const express = require('express');
const router = express.Router();
const { verifyJWT, requireFinance } = require('../lib/middleware');
const c = require('../controllers/ledgerControllers');

router.use(verifyJWT, requireFinance);

router.get('/ledger/chart', c.listChart);
router.post('/ledger/chart/seed', c.seedChart);

router.get('/ledger/journals', c.listJournals);
router.get('/ledger/journals/:id', c.getJournal);
router.post('/ledger/journals', c.createManualJournal);

router.get('/ledger/customers/:id', (req, res) => c.partyLedger(req, res, 'customer'));
router.get('/ledger/vendors/:id', (req, res) => c.partyLedger(req, res, 'vendor'));

router.get('/ledger/payments', c.listPayments);
router.post('/ledger/payments', c.createPayment);
router.patch('/ledger/payments/:id/post', c.postPaymentHandler);
router.patch('/ledger/payments/:id/void', c.voidPaymentHandler);

router.get('/ledger/vendor-bills', c.listVendorBills);
router.post('/ledger/vendor-bills', c.createVendorBill);
router.patch('/ledger/vendor-bills/:id/post', c.postVendorBillHandler);
router.patch('/ledger/vendor-bills/:id/cancel', c.cancelVendorBillHandler);

router.get('/ledger/postings/failed', c.listFailedPostings);
router.get('/ledger/postings/unposted-invoices', c.listUnpostedInvoices);
router.post('/ledger/postings/retry', c.retryPosting);

module.exports = router;
