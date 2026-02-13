const express = require('express');
const {
	createProduct,
	getProducts,
	deleteProduct,
} = require('../controllers/productControllers.js');
const { verifyJWT, requireAdmin } = require('../lib/middleware.js');
const router = express.Router();

router.post('/create', verifyJWT, requireAdmin, createProduct);
router.get('/get', verifyJWT, getProducts);
router.delete('/delete/:id', verifyJWT, requireAdmin, deleteProduct);

module.exports = router;
