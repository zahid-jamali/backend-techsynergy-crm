const express = require('express');
const contactControllers = require('../controllers/contactControllers.js');
const { verifyJWT, requireAdmin } = require('../lib/middleware.js');
const router = express.Router();

router.post('/create', verifyJWT, contactControllers.createContact);
router.get('/my', verifyJWT, contactControllers.getMyContacts);
router.put('/update/:id', verifyJWT, contactControllers.updateContact);
router.delete('/delete/:id', verifyJWT, contactControllers.deleteContact);

// Admin
router.get('/all', verifyJWT, requireAdmin, contactControllers.getAllContacts);

module.exports = router;
