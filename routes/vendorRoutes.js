const express = require('express');
const {
	createVendor,
	getVendors,
	updateVendor,
	deleteVendor,
} = require('../controllers/vendorControllers.js');
const { verifyJWT, requireAdmin } = require('../lib/middleware.js');

const router = express.Router();

router.post('/create', verifyJWT, requireAdmin, createVendor);
router.get('/get', verifyJWT, getVendors);
router.put('/update/:id', verifyJWT, requireAdmin, updateVendor);
router.delete('/delete/:id', verifyJWT, requireAdmin, deleteVendor);

module.exports = router;
