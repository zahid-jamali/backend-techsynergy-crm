const express = require('express');
const router = express.Router();
const controller = require('../controllers/orderControllers.js');
const { verifyJWT, requireAdmin } = require('../lib/middleware.js');
const uploadPO = require('../lib/poUpload.js');

router.post(
	'/create',
	verifyJWT,
	uploadPO.single('purchaseOrder'),
	controller.createOrderFromConfirmedQuote
);
router.get('/my', verifyJWT, controller.getMyOrders);

router.get('/all', verifyJWT, controller.getAllOrders);

router.delete('/:orderId/delete', verifyJWT, controller.deleteOrder);

router.patch(
	'/:orderId/approval',
	verifyJWT,
	requireAdmin,
	controller.soApproval
);

module.exports = router;
