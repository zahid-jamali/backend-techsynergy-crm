const mongoose = require('mongoose');
const PriceQueryMessage = require('../models/PriceQueryMessage');
const User = require('../models/Users');
const Account = require('../models/Account');
const { resolveRole } = require('../lib/middleware');
const { regex } = require('../lib/listQuery');
const { notifyPriceQueryPosted } = require('../lib/notifications');

const IMAGE_MIMES = /^image\//;
const OPS_ROLES = ['admin', 'operations'];

const mapAttachment = (file) => {
	const mime = file.mimetype || '';
	return {
		public_id: file.filename || file.public_id,
		url: file.path,
		originalName: file.originalname,
		mimeType: mime,
		resourceType: IMAGE_MIMES.test(mime) ? 'image' : 'raw',
		bytes: file.size,
	};
};

const populateSender = { path: 'sender', select: 'name email role designation' };
const populateMessage = [
	populateSender,
	{ path: 'account', select: 'accountName' },
	{
		path: 'replyTo',
		select: 'body sender senderRole createdAt threadOwner',
		populate: { path: 'sender', select: 'name role' },
	},
	{ path: 'threadOwner', select: 'name email' },
];

const isOps = (role) => OPS_ROLES.includes(role);

const toId = (value) => {
	if (!value) return null;
	if (value instanceof mongoose.Types.ObjectId) return value;
	const raw = String(value);
	if (mongoose.Types.ObjectId.isValid(raw)) {
		return new mongoose.Types.ObjectId(raw);
	}
	return null;
};

const threadFilter = (staffId) => {
	const id = toId(staffId);
	if (!id) return { _id: null };
	return {
		$or: [
			{ threadOwner: id },
			{
				sender: id,
				$or: [{ threadOwner: { $exists: false } }, { threadOwner: null }],
			},
		],
	};
};

const ownerExpression = {
	$ifNull: ['$threadOwner', '$sender'],
};

const scopedMessageFilter = (req) => {
	const role = resolveRole(req.user);
	const filter = { isActive: true };
	const search = String(req.query.search || '').trim();
	if (search) filter.body = regex(search);

	if (!isOps(role)) {
		Object.assign(filter, threadFilter(req.user.id));
		return filter;
	}

	const threadOwner = String(req.query.threadOwner || req.query.staffId || '').trim();
	if (threadOwner && mongoose.Types.ObjectId.isValid(threadOwner)) {
		Object.assign(filter, threadFilter(threadOwner));
	}
	return filter;
};

const listThreads = async (req, res) => {
	try {
		if (!isOps(resolveRole(req.user))) {
			return res.status(403).json({
				success: false,
				msg: 'Only operations and admin can list all threads',
			});
		}

		const staff = await User.find({
			isActive: { $ne: false },
			isSuperUser: { $ne: true },
			role: { $nin: ['admin', 'operations', 'finance'] },
		})
			.select('name email designation role')
			.sort({ name: 1 });

		const viewer = await User.findById(req.user.id).select(
			'priceQueryLastReadAt'
		);
		const lastRead = viewer?.priceQueryLastReadAt;

		const lastRows = await PriceQueryMessage.aggregate([
			{ $match: { isActive: true } },
			{ $addFields: { owner: ownerExpression } },
			{ $match: { owner: { $ne: null } } },
			{ $sort: { createdAt: -1 } },
			{
				$group: {
					_id: '$owner',
					lastBody: { $first: '$body' },
					lastAt: { $first: '$createdAt' },
					lastSenderRole: { $first: '$senderRole' },
				},
			},
		]);

		const viewerId = toId(req.user.id);
		const unreadMatch = {
			isActive: true,
			...(viewerId ? { sender: { $ne: viewerId } } : {}),
		};
		if (lastRead) unreadMatch.createdAt = { $gt: lastRead };

		const unreadRows = lastRead
			? await PriceQueryMessage.aggregate([
					{ $match: unreadMatch },
					{ $addFields: { owner: ownerExpression } },
					{ $match: { owner: { $ne: null } } },
					{ $group: { _id: '$owner', count: { $sum: 1 } } },
			  ])
			: [];

		const lastMap = new Map(
			lastRows.map((row) => [String(row._id), row])
		);
		const unreadMap = new Map(
			unreadRows.map((row) => [String(row._id), row.count])
		);

		const staffById = new Map(
			staff.map((person) => [String(person._id), person])
		);
		const extraIds = lastRows
			.map((row) => String(row._id))
			.filter((id) => mongoose.Types.ObjectId.isValid(id) && !staffById.has(id));
		if (extraIds.length) {
			const extra = await User.find({ _id: { $in: extraIds } }).select(
				'name email designation role'
			);
			extra.forEach((person) => staffById.set(String(person._id), person));
		}

		const data = [...staffById.values()].map((person) => {
			const last = lastMap.get(String(person._id));
			return {
				staff: person,
				lastBody: last?.lastBody || '',
				lastAt: last?.lastAt || null,
				lastSenderRole: last?.lastSenderRole || null,
				unread: unreadMap.get(String(person._id)) || 0,
			};
		});

		data.sort((a, b) => {
			const aTime = a.lastAt ? new Date(a.lastAt).getTime() : 0;
			const bTime = b.lastAt ? new Date(b.lastAt).getTime() : 0;
			return (
				bTime - aTime ||
				String(a.staff.name || '').localeCompare(String(b.staff.name || ''))
			);
		});

		return res.json({ success: true, data });
	} catch (error) {
		console.error('List price query threads error:', error);
		return res.status(500).json({
			success: false,
			msg: 'Failed to load query threads',
		});
	}
};

const listMessages = async (req, res) => {
	try {
		const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 40));
		const filter = scopedMessageFilter(req);
		const since = req.query.since;
		const before = req.query.before;

		if (since && mongoose.Types.ObjectId.isValid(since)) {
			if (filter._id === null) {
				return res.json({ success: true, data: [] });
			}
			filter._id = { $gt: since };
			const data = await PriceQueryMessage.find(filter)
				.populate(populateSender)
				.sort({ _id: 1 })
				.limit(limit);
			return res.json({ success: true, data });
		}

		if (filter._id === null) {
			return res.json({
				success: true,
				data: [],
				pagination: { hasMore: false, limit },
			});
		}

		if (before && mongoose.Types.ObjectId.isValid(before)) {
			filter._id = { $lt: before };
		}

		const rows = await PriceQueryMessage.find(filter)
			.populate(populateMessage)
			.sort({ _id: -1 })
			.limit(limit + 1);

		const hasMore = rows.length > limit;
		const slice = hasMore ? rows.slice(0, limit) : rows;
		const data = slice.reverse();

		return res.json({
			success: true,
			data,
			pagination: { hasMore, limit },
		});
	} catch (error) {
		console.error('List price query messages error:', error);
		return res.status(500).json({
			success: false,
			msg: 'Failed to load price queries',
		});
	}
};

const createMessage = async (req, res) => {
	try {
		const role = resolveRole(req.user);
		if (!['admin', 'staff', 'operations'].includes(role)) {
			return res.status(403).json({
				success: false,
				msg: 'You cannot post in this room',
			});
		}

		const body = String(req.body.body || '').trim();
		const attachments = (req.files || []).map(mapAttachment);

		if (!body && attachments.length === 0) {
			return res.status(400).json({
				success: false,
				msg: 'Write a message or attach a file',
			});
		}

		if (body.length > 8000) {
			return res.status(400).json({
				success: false,
				msg: 'Message is too long',
			});
		}

		const replyToId = toId(req.body.replyTo);
		let parent = null;
		if (replyToId) {
			parent = await PriceQueryMessage.findOne({
				_id: replyToId,
				isActive: true,
			});
			if (!parent) {
				return res.status(400).json({
					success: false,
					msg: 'The message you are replying to was not found',
				});
			}
			if (!isOps(role)) {
				const parentOwner = String(parent.threadOwner || parent.sender);
				if (parentOwner !== String(req.user.id)) {
					return res.status(403).json({
						success: false,
						msg: 'You can only reply inside your own query thread',
					});
				}
			}
		}

		let threadOwner = toId(req.user.id);
		if (isOps(role)) {
			const requested = String(req.body.threadOwner || '').trim();
			const ownerId = toId(requested) || toId(parent?.threadOwner || parent?.sender);
			if (!ownerId) {
				return res.status(400).json({
					success: false,
					msg: 'Select a staff member, or reply to a specific message',
				});
			}
			const owner = await User.findById(ownerId).select('role isActive isSuperUser');
			if (
				!owner ||
				owner.isSuperUser ||
				['admin', 'operations', 'finance'].includes(owner.role)
			) {
				return res.status(400).json({
					success: false,
					msg: 'Price queries can only be attached to a staff member',
				});
			}
			threadOwner = owner._id;
		}

		let accountId = toId(req.body.account) || toId(parent?.account);
		if (!isOps(role) && !accountId) {
			return res.status(400).json({
				success: false,
				msg: 'Select an account before sending a price query',
			});
		}
		if (accountId) {
			const accountDoc = await Account.findOne({
				_id: accountId,
				isActive: true,
				isArchived: { $ne: true },
			}).select('_id');
			if (!accountDoc) {
				return res.status(400).json({
					success: false,
					msg: 'Account not found',
				});
			}
		}

		const message = await PriceQueryMessage.create({
			body,
			sender: req.user.id,
			senderRole: role === 'staff' ? 'staff' : role,
			threadOwner,
			account: accountId || undefined,
			replyTo: parent?._id,
			attachments,
		});

		await User.findByIdAndUpdate(req.user.id, {
			priceQueryLastReadAt: new Date(),
		});

		const populated = await PriceQueryMessage.findById(message._id).populate(
			populateMessage
		);
		await notifyPriceQueryPosted(populated, req.user);
		return res.status(201).json({
			success: true,
			data: populated,
		});
	} catch (error) {
		console.error('Create price query error:', error);
		return res.status(500).json({
			success: false,
			msg: 'Failed to send message',
		});
	}
};

const deleteMessage = async (req, res) => {
	try {
		const { id } = req.params;
		if (!mongoose.Types.ObjectId.isValid(id)) {
			return res.status(400).json({ success: false, msg: 'Invalid message' });
		}

		const message = await PriceQueryMessage.findOne({
			_id: id,
			isActive: true,
		});
		if (!message) {
			return res.status(404).json({ success: false, msg: 'Message not found' });
		}

		const role = resolveRole(req.user);
		const isOwner = String(message.sender) === String(req.user.id);
		if (role === 'staff') {
			const inOwnThread =
				String(message.threadOwner || message.sender) === String(req.user.id);
			if (!isOwner || !inOwnThread) {
				return res.status(403).json({
					success: false,
					msg: 'You can only delete your own messages',
				});
			}
		} else if (!isOwner && role !== 'admin') {
			return res.status(403).json({
				success: false,
				msg: 'You can only delete your own messages',
			});
		}

		message.isActive = false;
		await message.save();
		return res.json({ success: true, msg: 'Message removed' });
	} catch (error) {
		console.error('Delete price query error:', error);
		return res.status(500).json({
			success: false,
			msg: 'Failed to delete message',
		});
	}
};

const markRead = async (req, res) => {
	try {
		await User.findByIdAndUpdate(req.user.id, {
			priceQueryLastReadAt: new Date(),
		});
		return res.json({ success: true });
	} catch (error) {
		console.error('Mark price query read error:', error);
		return res.status(500).json({ success: false, msg: 'Failed to mark read' });
	}
};

const getUnread = async (req, res) => {
	try {
		const user = await User.findById(req.user.id).select('priceQueryLastReadAt');
		if (!user?.priceQueryLastReadAt) {
			return res.json({ success: true, count: 0 });
		}

		const filter = {
			isActive: true,
			sender: { $ne: req.user.id },
			createdAt: { $gt: user.priceQueryLastReadAt },
		};
		if (!isOps(resolveRole(req.user))) {
			Object.assign(filter, threadFilter(req.user.id));
		}

		const count = await PriceQueryMessage.countDocuments(filter);
		return res.json({ success: true, count });
	} catch (error) {
		console.error('Unread price query error:', error);
		return res.status(500).json({ success: false, msg: 'Failed to load unread' });
	}
};

module.exports = {
	listThreads,
	listMessages,
	createMessage,
	deleteMessage,
	markRead,
	getUnread,
};
