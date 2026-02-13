const express = require('express');
const {
	createPOToVendor,
	getAllPOs,
	getPOById,
	updatePOToVendor,
	deletePOToVendor,
	generatePOToVendorPdf,
} = require('../controllers/poToVendorControllers');
const { verifyJWT, requireAdmin } = require('../lib/middleware.js');

const router = express.Router();

router.post('/create', verifyJWT, requireAdmin, createPOToVendor);
router.get('/get', verifyJWT, requireAdmin, getAllPOs);
router.put('/update/:id', verifyJWT, requireAdmin, updatePOToVendor);
router.delete('/delete/:id', verifyJWT, requireAdmin, deletePOToVendor);
router.get('/:id/pdf', generatePOToVendorPdf);

module.exports = router;
