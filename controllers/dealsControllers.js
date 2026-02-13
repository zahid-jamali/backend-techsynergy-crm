const mongoose = require('mongoose');
const Deals = require('../models/Deals.js');

const updateDeal = async (req, res) => {
	try {
		const { id } = req.params;

		if (!mongoose.Types.ObjectId.isValid(id)) {
			return res
				.status(400)
				.json({ success: false, msg: 'Invalid deal ID' });
		}

		let {
			dealName,
			dealType,
			stage,
			nextStep,
			previousStep,
			amount,
			probability,
			closingDate,
			description,
			contact,
		} = req.body;

		const deal = await Deals.findById(id);

		if (!deal) {
			return res
				.status(404)
				.json({ success: false, msg: 'Deal not found' });
		}

		/* 🔒 Ownership check */
		if (deal.dealOwner.toString() !== req.user.id) {
			return res
				.status(403)
				.json({ success: false, msg: 'Unauthorized' });
		}

		/* ✅ Normalize */
		deal.dealName = dealName ?? deal.dealName;
		deal.dealType = dealType ?? deal.dealType;
		deal.stage = stage ?? deal.stage;
		deal.nextStep = nextStep ?? deal.nextStep;
		deal.previousStep = previousStep ?? deal.previousStep;
		deal.amount = amount !== undefined ? Number(amount) : deal.amount;
		deal.probability =
			probability !== undefined ? Number(probability) : deal.probability;
		deal.closingDate = closingDate || deal.closingDate;
		deal.description = description ?? deal.description;
		deal.contact = contact || deal.contact;

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

		if (deal.dealOwner.toString() !== req.user.id) {
			return res
				.status(403)
				.json({ success: false, msg: 'Unauthorized' });
		}

		/* 🔄 Maintain previous step */
		deal.previousStep = deal.stage;
		deal.stage = stage;
		deal.nextStep = nextStep || '';

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
			probability,
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
			probability,
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
		const data = await Deals.find({ dealOwner: req.user.id }).populate(
			'account contact'
		);
		res.status(200).send(data);
	} catch (err) {
		console.error(err);
		res.status(500).json({ msg: 'Internal server error!!!' });
	}
};

// =======================================================================================
// Admin Area
// =========================================================================================

const getAllDeals = async (req, res) => {
	try {
		const data = await Deals.find().populate('account contact dealOwner');
		res.status(200).send(data);
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
};
