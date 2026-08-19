const CalendarEvent = require('../models/CalendarEvent');
const Todo = require('../models/Todo');
const Notebook = require('../models/Notebook');

const ownerId = (doc) => doc.createdBy?._id || doc.createdBy;
const isOwner = (doc, userId) => String(ownerId(doc)) === String(userId);

const getEvents = async (req, res) => {
	try {
		const { from, to } = req.query;
		const filter = { createdBy: req.user.id };
		if (from || to) {
			filter.start = {};
			if (from) filter.start.$gte = new Date(from);
			if (to) filter.start.$lte = new Date(to);
		}
		const events = await CalendarEvent.find(filter).sort({ start: 1 });
		return res.json({ success: true, data: events });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ msg: 'Failed to load calendar' });
	}
};

const createEvent = async (req, res) => {
	try {
		const { title, description, start, end, allDay, color } = req.body;
		if (!title || !start) {
			return res.status(400).json({ msg: 'Title and start date are required' });
		}
		const event = await CalendarEvent.create({
			title,
			description,
			start,
			end: end || start,
			allDay: allDay !== false,
			color: color || 'brand',
			createdBy: req.user.id,
		});
		return res.status(201).json({ success: true, data: event });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ msg: 'Failed to create event' });
	}
};

const updateEvent = async (req, res) => {
	try {
		const event = await CalendarEvent.findById(req.params.id);
		if (!event || !isOwner(event, req.user.id)) {
			return res.status(404).json({ msg: 'Event not found' });
		}
		const fields = ['title', 'description', 'start', 'end', 'allDay', 'color'];
		fields.forEach((key) => {
			if (req.body[key] !== undefined) event[key] = req.body[key];
		});
		await event.save();
		return res.json({ success: true, data: event });
	} catch (error) {
		return res.status(500).json({ msg: 'Failed to update event' });
	}
};

const deleteEvent = async (req, res) => {
	try {
		const event = await CalendarEvent.findById(req.params.id);
		if (!event || !isOwner(event, req.user.id)) {
			return res.status(404).json({ msg: 'Event not found' });
		}
		await event.deleteOne();
		return res.json({ success: true, msg: 'Event deleted' });
	} catch (error) {
		return res.status(500).json({ msg: 'Failed to delete event' });
	}
};

const getTodos = async (req, res) => {
	try {
		const { status } = req.query;
		const filter = { createdBy: req.user.id };
		if (status) filter.status = status;
		const todos = await Todo.find(filter).sort({
			status: 1,
			dueDate: 1,
			createdAt: -1,
		});
		return res.json({ success: true, data: todos });
	} catch (error) {
		return res.status(500).json({ msg: 'Failed to load todos' });
	}
};

const createTodo = async (req, res) => {
	try {
		const { title, notes, priority, dueDate, status } = req.body;
		if (!title?.trim()) {
			return res.status(400).json({ msg: 'Title is required' });
		}
		const todo = await Todo.create({
			title: title.trim(),
			notes,
			priority: priority || 'medium',
			dueDate: dueDate || undefined,
			status: status || 'open',
			createdBy: req.user.id,
		});
		return res.status(201).json({ success: true, data: todo });
	} catch (error) {
		return res.status(500).json({ msg: 'Failed to create todo' });
	}
};

const updateTodo = async (req, res) => {
	try {
		const todo = await Todo.findById(req.params.id);
		if (!todo || !isOwner(todo, req.user.id)) {
			return res.status(404).json({ msg: 'Todo not found' });
		}
		const fields = ['title', 'notes', 'priority', 'dueDate', 'status'];
		fields.forEach((key) => {
			if (req.body[key] !== undefined) todo[key] = req.body[key] || undefined;
		});
		await todo.save();
		return res.json({ success: true, data: todo });
	} catch (error) {
		return res.status(500).json({ msg: 'Failed to update todo' });
	}
};

const deleteTodo = async (req, res) => {
	try {
		const todo = await Todo.findById(req.params.id);
		if (!todo || !isOwner(todo, req.user.id)) {
			return res.status(404).json({ msg: 'Todo not found' });
		}
		await todo.deleteOne();
		return res.json({ success: true, msg: 'Todo deleted' });
	} catch (error) {
		return res.status(500).json({ msg: 'Failed to delete todo' });
	}
};

const getNotebooks = async (req, res) => {
	try {
		const { scope = 'all' } = req.query;
		let filter;
		if (scope === 'private') {
			filter = { createdBy: req.user.id, visibility: 'private' };
		} else if (scope === 'public') {
			filter = { visibility: 'public' };
		} else if (scope === 'mine') {
			filter = { createdBy: req.user.id };
		} else {
			filter = {
				$or: [{ createdBy: req.user.id }, { visibility: 'public' }],
			};
		}

		const notes = await Notebook.find(filter)
			.select('-content')
			.populate('createdBy', 'name email role')
			.sort({ pinned: -1, updatedAt: -1 });

		return res.json({ success: true, data: notes });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ msg: 'Failed to load notebooks' });
	}
};

const getNotebook = async (req, res) => {
	try {
		const note = await Notebook.findById(req.params.id).populate(
			'createdBy',
			'name email role'
		);
		if (!note) return res.status(404).json({ msg: 'Note not found' });
		const mine = isOwner(note, req.user.id);
		if (!mine && note.visibility !== 'public') {
			return res.status(403).json({ msg: 'This note is private' });
		}
		return res.json({ success: true, data: note, canEdit: mine });
	} catch (error) {
		return res.status(500).json({ msg: 'Failed to load note' });
	}
};

const createNotebook = async (req, res) => {
	try {
		const { title, content, visibility, pinned } = req.body;
		const note = await Notebook.create({
			title: title?.trim() || 'Untitled note',
			content: content || '',
			visibility: visibility === 'public' ? 'public' : 'private',
			pinned: Boolean(pinned),
			createdBy: req.user.id,
		});
		const populated = await note.populate('createdBy', 'name email role');
		return res.status(201).json({ success: true, data: populated, canEdit: true });
	} catch (error) {
		return res.status(500).json({ msg: 'Failed to create note' });
	}
};

const updateNotebook = async (req, res) => {
	try {
		const note = await Notebook.findById(req.params.id);
		if (!note || !isOwner(note, req.user.id)) {
			return res.status(404).json({ msg: 'Note not found' });
		}
		const fields = ['title', 'content', 'visibility', 'pinned'];
		fields.forEach((key) => {
			if (req.body[key] !== undefined) note[key] = req.body[key];
		});
		if (note.visibility !== 'public') note.visibility = 'private';
		await note.save();
		const populated = await note.populate('createdBy', 'name email role');
		return res.json({ success: true, data: populated, canEdit: true });
	} catch (error) {
		return res.status(500).json({ msg: 'Failed to update note' });
	}
};

const deleteNotebook = async (req, res) => {
	try {
		const note = await Notebook.findById(req.params.id);
		if (!note || !isOwner(note, req.user.id)) {
			return res.status(404).json({ msg: 'Note not found' });
		}
		await note.deleteOne();
		return res.json({ success: true, msg: 'Note deleted' });
	} catch (error) {
		return res.status(500).json({ msg: 'Failed to delete note' });
	}
};

module.exports = {
	getEvents,
	createEvent,
	updateEvent,
	deleteEvent,
	getTodos,
	createTodo,
	updateTodo,
	deleteTodo,
	getNotebooks,
	getNotebook,
	createNotebook,
	updateNotebook,
	deleteNotebook,
};
