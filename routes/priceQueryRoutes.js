const express = require('express');
const router = express.Router();
const { verifyJWT, requirePriceQuery } = require('../lib/middleware');
const { handleChatUpload } = require('../lib/chatUpload');
const controller = require('../controllers/priceQueryControllers');

router.use(verifyJWT, requirePriceQuery);

router.get('/threads', controller.listThreads);
router.get('/messages', controller.listMessages);
router.post('/messages', handleChatUpload, controller.createMessage);
router.delete('/messages/:id', controller.deleteMessage);
router.post('/read', controller.markRead);
router.get('/unread', controller.getUnread);

module.exports = router;
