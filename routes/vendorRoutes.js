const express = require('express');
const {
	createVendor,
	getVendors,
	updateVendor,
	deleteVendor,
} = require('../controllers/vendorControllers.js');
const { verifyJWT, requireAdmin, requireOperations } = require('../lib/middleware.js');

const router = express.Router();

router.post('/create', verifyJWT, requireOperations, createVendor);
router.get('/get', verifyJWT, getVendors);
router.put('/update/:id', verifyJWT, requireOperations, updateVendor);
router.delete('/delete/:id', verifyJWT, requireAdmin, deleteVendor);

module.exports = router;
