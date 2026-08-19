const express = require('express');
const router = express.Router();
const { verifyJWT } = require('../lib/middleware');
const c = require('../controllers/workspaceControllers');

router.use(verifyJWT);

router.get('/calendar', c.getEvents);
router.post('/calendar', c.createEvent);
router.put('/calendar/:id', c.updateEvent);
router.delete('/calendar/:id', c.deleteEvent);

router.get('/todos', c.getTodos);
router.post('/todos', c.createTodo);
router.put('/todos/:id', c.updateTodo);
router.delete('/todos/:id', c.deleteTodo);

router.get('/notebooks', c.getNotebooks);
router.get('/notebooks/:id', c.getNotebook);
router.post('/notebooks', c.createNotebook);
router.put('/notebooks/:id', c.updateNotebook);
router.delete('/notebooks/:id', c.deleteNotebook);

module.exports = router;
