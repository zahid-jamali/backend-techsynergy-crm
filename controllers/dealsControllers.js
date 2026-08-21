const mongoose = require('mongoose');
const Deals = require('../models/Deals.js');
const User = require('../models/Users');
const Account = require('../models/Account');
const Contact = require('../models/Contacts');
const {
	parseListQuery,
	regex,
	sendPage,
	paginate,
} = require('../lib/listQuery');

const stageProbabilityMap = {
	Qualification: 10,
	'Needs Analysis': 20,
	'Value Proposition': 35,
	'Identify Decision Makers': 45,
	'Proposal/Price Quote': 60,
	'Negotiation/Review': 80,
	'Closed Won': 100,
	'Closed Lost': 0,
	'Closed Lost to Competition': 0,
};

const updateDeal = async (req, res) => {
	try {
		const { id } = req.params;

		let {
			dealName,
			dealType,
			stage,
			nextStep,
			previousStep,
			amount,
			currency,
			closingDate,
			description,
			contact,
			account,
		} = req.body;

		let usr = await User.findById(req.user.id);
		let deal;
		if (usr.isSuperUser) {
			deal = await Deals.findById(id);
		} else {
			deal = await Deals.findOne({ _id: id, dealOwner: req.user.id });
		}
		if (!deal) {
			return res
				.status(404)
				.json({ success: false, msg: 'Deal not found' });
		}

		if (account) {
			if (!mongoose.Types.ObjectId.isValid(account)) {
				return res.status(400).json({
					success: false,
					msg: 'Invalid account ID',
				});
			}
			const accountDoc = await Account.findOne({
				_id: account,
				isActive: true,
				isArchived: { $ne: true },
			});
			if (!accountDoc) {
				return res.status(404).json({
					success: false,
					msg: 'Account not found or archived',
				});
			}
			deal.account = account;
		}

		if (contact) {
			if (!mongoose.Types.ObjectId.isValid(contact)) {
				return res.status(400).json({
					success: false,
					msg: 'Invalid contact ID',
				});
			}
			const contactDoc = await Contact.findOne({
				_id: contact,
				isActive: true,
				isArchived: { $ne: true },
			});
			if (!contactDoc) {
				return res.status(404).json({
					success: false,
					msg: 'Contact not found or archived',
				});
			}
			const accountId = deal.account;
			if (
				contactDoc.account &&
				String(contactDoc.account) !== String(accountId)
			) {
				return res.status(400).json({
					success: false,
					msg: 'Contact does not belong to the selected account',
				});
			}
		}

		/* ✅ Normalize */
		deal.dealName = dealName ?? deal.dealName;
		deal.dealType = dealType ?? deal.dealType;
		deal.stage = stage ?? deal.stage;
		deal.nextStep = nextStep ?? deal.nextStep;
		deal.previousStep = previousStep ?? deal.previousStep;
		deal.amount = amount !== undefined ? Number(amount) : deal.amount;
		deal.currency = currency !== undefined ? currency : deal.currency;
		deal.closingDate = closingDate || deal.closingDate;
		deal.description = description ?? deal.description;
		deal.contact = contact || deal.contact;
		deal.probability = stageProbabilityMap[stage];
		await deal.save(); // expectedRevenue recalculated automatically

		return res.json({
			success: true,
			msg: 'Deal updated successfully',
			data: deal,
		});
	} catch (error) {
		console.error('Update Deal Error:', error);
		res.status(500).json({ success: false, msg: 'Server error' });
	}
};

const updateDealStage = async (req, res) => {
	try {
		const { id } = req.params;
		const { stage, nextStep } = req.body;

		const deal = await Deals.findById(id);
		if (!deal) {
			return res
				.status(404)
				.json({ success: false, msg: 'Deal not found' });
		}
		const tmp = await User.findById(req.user.id);
		if (deal.dealOwner.toString() !== req.user.id && !tmp.isSuperUser) {
			return res.status(403).json({
				success: false,
				msg: 'Unauthorized',
			});
		}

		/* 🔄 Maintain previous step */
		deal.previousStep = deal.stage;
		deal.stage = stage;
		deal.nextStep = nextStep || '';
		deal.probability = stageProbabilityMap[stage];

		await deal.save();

		res.json({
			success: true,
			msg: 'Deal stage updated',
			data: deal,
		});
	} catch (error) {
		console.error('Update Stage Error:', error);
		res.status(500).json({ success: false, msg: 'Server error' });
	}
};

const createDeal = async (req, res) => {
	try {
		const {
			dealName,
			account,
			contact,
			dealType,
			stage,
			nextStep,
			previousStep,
			amount,
			currency,
			closingDate,
			description,
			meta,
		} = req.body;

		if (!dealName || !account) {
			return res.status(400).json({
				success: false,
				msg: 'Deal name and account are required',
			});
		}

		if (!mongoose.Types.ObjectId.isValid(account)) {
			return res.status(400).json({
				success: false,
				msg: 'Invalid account ID',
			});
		}

		if (contact && !mongoose.Types.ObjectId.isValid(contact)) {
			return res.status(400).json({
				success: false,
				msg: 'Invalid contact ID',
			});
		}

		const accountDoc = await Account.findOne({
			_id: account,
			isActive: true,
			isArchived: { $ne: true },
		});
		if (!accountDoc) {
			return res.status(404).json({
				success: false,
				msg: 'Account not found or archived',
			});
		}

		if (contact) {
			const contactDoc = await Contact.findOne({
				_id: contact,
				isActive: true,
				isArchived: { $ne: true },
			});
			if (!contactDoc) {
				return res.status(404).json({
					success: false,
					msg: 'Contact not found or archived',
				});
			}
			if (
				contactDoc.account &&
				String(contactDoc.account) !== String(account)
			) {
				return res.status(400).json({
					success: false,
					msg: 'Contact does not belong to the selected account',
				});
			}
		}

		const deal = await Deals.create({
			dealOwner: req.user.id,
			dealName: dealName.trim(),
			account,
			currency,
			contact,
			dealType,
			stage,
			nextStep,
			previousStep,
			amount,
			probability: stageProbabilityMap.stage,
			closingDate,
			description,
			meta,
		});

		return res.status(201).json({
			success: true,
			msg: 'Deal created successfully',
			data: deal,
		});
	} catch (error) {
		console.error('Create Deal Error:', error);

		return res.status(500).json({
			success: false,
			msg: 'Server error while creating deal',
		});
	}
};

const getMyDeals = async (req, res) => {
	try {
		const { page, limit, search } = parseListQuery(req);
		const filter = { dealOwner: req.user.id, isActive: { $ne: false } };
		if (req.query.stage) filter.stage = req.query.stage;
		if (req.query.currency) filter.currency = req.query.currency;
		if (req.query.account) filter.account = req.query.account;
		if (search) {
			filter.$or = [{ dealName: regex(search) }, { nextStep: regex(search) }];
		}
		const result = await paginate(Deals, {
			filter,
			page,
			limit,
			populate: [
				{ path: 'account', select: 'accountName' },
				{ path: 'contact', select: 'firstName lastName email' },
				{ path: 'dealOwner', select: 'name email' },
			],
		});
		return sendPage(res, result.data, result);
	} catch (err) {
		console.error(err);
		res.status(500).json({ msg: 'Internal server error!!!' });
	}
};

const getAllDeals = async (req, res) => {
	try {
		const { page, limit, search } = parseListQuery(req);
		const filter = { isActive: { $ne: false } };
		if (req.query.stage) filter.stage = req.query.stage;
		if (req.query.currency) filter.currency = req.query.currency;
		if (req.query.owner) filter.dealOwner = req.query.owner;
		if (req.query.account) filter.account = req.query.account;
		if (search) {
			filter.$or = [{ dealName: regex(search) }, { nextStep: regex(search) }];
		}
		const result = await paginate(Deals, {
			filter,
			page,
			limit,
			populate: [
				{ path: 'account', select: 'accountName' },
				{ path: 'contact', select: 'firstName lastName email' },
				{ path: 'dealOwner', select: 'name email' },
			],
		});
		return sendPage(res, result.data, result);
	} catch (err) {
		console.error(err);
		res.status(500).json({ msg: 'Internal server error!!!' });
	}
};

const lookupDeals = async (req, res) => {
	try {
		const search = String(req.query.search || '').trim();
		const limit = Math.min(40, parseInt(req.query.limit, 10) || 20);
		const filter = { isActive: { $ne: false } };
		if (req.query.account) filter.account = req.query.account;
		if (search) filter.dealName = regex(search);
		const data = await Deals.find(filter)
			.populate('account', 'accountName')
			.populate('contact', 'firstName lastName')
			.populate('dealOwner', 'name')
			.sort({ updatedAt: -1 })
			.limit(limit);
		return res.json({ success: true, data });
	} catch (err) {
		console.error(err);
		res.status(500).json({ msg: 'Internal server error!!!' });
	}
};

module.exports = {
	createDeal,
	getMyDeals,
	updateDeal,
	updateDealStage,
	getAllDeals,
	lookupDeals,
};
