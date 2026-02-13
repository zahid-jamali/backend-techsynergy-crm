const express = require('express');
const userControllers = require('../controllers/userControllers');
const { verifyJWT, requireAdmin } = require('../lib/middleware.js');
const router = express.Router();

router.get('/all', verifyJWT, requireAdmin, userControllers.getAllUsers);
router.put(
	'/update/:id',
	verifyJWT,
	requireAdmin,
	userControllers.updateUserByAdmin
);

router.put('/update', verifyJWT, userControllers.updateUser);

router.post('/create', userControllers.createUser);
router.post('/login', userControllers.loginUser);

module.exports = router;
