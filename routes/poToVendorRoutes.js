const express = require('express');
const {
	createPOToVendor,
	getAllPOs,
	getPOById,
	updatePOToVendor,
	deletePOToVendor,
	generatePOToVendorPdf,
} = require('../controllers/poToVendorControllers');
const { verifyJWT, requireAdmin, requireOperations } = require('../lib/middleware.js');

const router = express.Router();

router.post('/create', verifyJWT, requireOperations, createPOToVendor);
router.get('/get', verifyJWT, requireOperations, getAllPOs);
router.put('/update/:id', verifyJWT, requireOperations, updatePOToVendor);
router.delete('/delete/:id', verifyJWT, requireOperations, deletePOToVendor);
router.get('/:id/pdf', generatePOToVendorPdf);

module.exports = router;
