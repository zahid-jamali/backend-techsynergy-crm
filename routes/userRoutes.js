const express = require('express');
const rateLimit = require('express-rate-limit');
const userControllers = require('../controllers/userControllers');
const { verifyJWT, requireAdmin } = require('../lib/middleware.js');
const router = express.Router();

const tooMany = (msg) => (req, res) => res.status(429).json({ msg, code: 'RATE_LIMITED' });

// Brute-force protection: per IP, on top of per-account lockout in the controller.
const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 10,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	skipSuccessfulRequests: true,
	handler: tooMany('Too many login attempts from this network. Please wait 15 minutes and try again.'),
});

const captchaLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 60,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	handler: tooMany('Too many verification requests. Please wait a few minutes.'),
});

const profileLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 20,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	handler: tooMany('Too many profile changes. Please wait a few minutes.'),
});

router.get('/all', verifyJWT, requireAdmin, userControllers.getAllUsers);
router.put(
	'/update/:id',
	verifyJWT,
	requireAdmin,
	userControllers.updateUserByAdmin
);

router.put('/update', verifyJWT, userControllers.updateUser);

router.get('/me', verifyJWT, userControllers.getMyProfile);
router.put('/me', verifyJWT, profileLimiter, userControllers.updateMyProfile);
router.put('/me/password', verifyJWT, profileLimiter, userControllers.changeMyPassword);

router.post('/create', verifyJWT, requireAdmin, userControllers.createUser);
router.get('/captcha', captchaLimiter, userControllers.getCaptcha);
router.post('/login', loginLimiter, userControllers.loginUser);

module.exports = router;
