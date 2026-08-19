const express = require('express');
const router = express.Router();
const controller = require('../controllers/deliveryControllers');
const { verifyJWT, requireOperations } = require('../lib/middleware');
const upload = require('../lib/poUpload');

const deliveryUpload = upload.fields([
	{ name: 'deliveryNote', maxCount: 1 },
	{ name: 'supportingDocuments', maxCount: 10 },
]);

router.get('/dashboard', verifyJWT, requireOperations, controller.getOperationsDashboard);
router.get('/', verifyJWT, requireOperations, controller.getDeliveries);
router.get('/:id', verifyJWT, requireOperations, controller.getDeliveryById);
router.post('/', verifyJWT, requireOperations, deliveryUpload, controller.createDelivery);
router.put('/:id', verifyJWT, requireOperations, deliveryUpload, controller.updateDelivery);
router.patch(
	'/:id/deliver',
	verifyJWT,
	requireOperations,
	deliveryUpload,
	controller.markDelivered
);
router.patch(
	'/:id/forward',
	verifyJWT,
	requireOperations,
	controller.forwardToFinance
);

module.exports = router;
