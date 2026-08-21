const Contact = require('../models/Contacts.js');
const Account = require('../models/Account');
const mongoose = require('mongoose');
const User = require('../models/Users');
const {
	parseListQuery,
	archiveMatch,
	regex,
	sendPage,
	paginate,
} = require('../lib/listQuery');
const { setArchived } = require('../lib/archiveRecord');

const createContact = async (req, res) => {
	try {
		const {
			firstName,
			lastName,
			account,
			email,
			phone,
			mobile,
			designation,
			postalAddress,
			description,
			meta,
		} = req.body;

		if (!firstName && !lastName) {
			return res.status(400).json({
				success: false,
				msg: 'At least first name or last name is required',
			});
		}

		if (account && !mongoose.Types.ObjectId.isValid(account)) {
			return res.status(400).json({
				success: false,
				msg: 'Invalid account ID',
			});
		}

		if (account) {
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
		}

		if (email) {
			const existingContact = await Contact.findOne({
				email: email.toLowerCase(),
				contactOwner: req.user.id,
			});

			if (existingContact) {
				return res.status(409).json({
					success: false,
					msg: 'Contact with this email already exists',
				});
			}
		}

		const contact = await Contact.create({
			contactOwner: req.user.id,
			firstName,
			lastName,
			account,
			designation,
			email,
			phone,
			mobile,
			postalAddress,
			description,
			meta,
		});

		return res.status(201).json({
			success: true,
			msg: 'Contact created successfully',
			data: contact,
		});
	} catch (error) {
		console.error('Create Contact Error:', error);

		return res.status(500).json({
			success: false,
			msg: 'Server error while creating contact',
		});
	}
};

const getMyContacts = async (req, res) => {
	try {
		const { page, limit, search, archived } = parseListQuery(req);
		const filter = {
			contactOwner: req.user.id,
			isActive: true,
			...archiveMatch(archived),
		};
		if (req.query.account) filter.account = req.query.account;
		if (search) {
			filter.$or = [
				{ firstName: regex(search) },
				{ lastName: regex(search) },
				{ email: regex(search) },
				{ phone: regex(search) },
				{ mobile: regex(search) },
				{ designation: regex(search) },
			];
		}
		const result = await paginate(Contact, {
			filter,
			page,
			limit,
			populate: [
				{ path: 'account', select: 'accountName' },
				{ path: 'contactOwner', select: 'name email' },
			],
		});
		return sendPage(res, result.data, result);
	} catch (err) {
		console.log(err);
		return res.status(500).json({ msg: 'Internal server error!!!' });
	}
};

const updateContact = async (req, res) => {
	try {
		const { id } = req.params;

		const usr = await User.findById(req.user.id);

		let contact;

		if (usr.isSuperUser) {
			contact = await Contact.findById(id);
		} else {
			contact = await Contact.findOne({
				_id: id,
				contactOwner: req.user.id,
			});
		}

		if (!contact) {
			return res.status(404).json({
				success: false,
				msg: 'Contact not found',
			});
		}

		const {
			firstName,
			lastName,
			account,
			email,
			phone,
			designation,
			mobile,
			postalAddress,
			description,
		} = req.body;

		// Validate account ID if provided
		if (account && !mongoose.Types.ObjectId.isValid(account)) {
			return res.status(400).json({
				success: false,
				msg: 'Invalid account ID',
			});
		}

		// Prevent duplicate email (excluding current contact)
		if (email && email.toLowerCase() !== contact.email) {
			const existingContact = await Contact.findOne({
				email: email.toLowerCase(),
				contactOwner: req.user.id,
				_id: { $ne: id },
			});

			if (existingContact) {
				return res.status(409).json({
					success: false,
					msg: 'Contact with this email already exists',
				});
			}

			contact.email = email.toLowerCase();
		}

		// Update fields if provided
		if (firstName !== undefined) contact.firstName = firstName;
		if (lastName !== undefined) contact.lastName = lastName;
		if (account !== undefined) contact.account = account;
		if (phone !== undefined) contact.phone = phone;
		if (mobile !== undefined) contact.mobile = mobile;
		if (postalAddress !== undefined) contact.postalAddress = postalAddress;
		if (description !== undefined) contact.description = description;
		if (designation !== undefined) contact.designation = designation;

		await contact.save();

		return res.status(200).json({
			success: true,
			msg: 'Contact updated successfully',
			data: contact,
		});
	} catch (error) {
		console.error('Update Contact Error:', error);

		return res.status(500).json({
			success: false,
			msg: 'Server error while updating contact',
		});
	}
};

const deleteContact = async (req, res) => {
	try {
		const { id } = req.params;

		const usr = await User.findById(req.user.id);

		let contact;

		if (usr.isSuperUser) {
			contact = await Contact.findById(id);
		} else {
			contact = await Contact.findOne({
				_id: id,
				contactOwner: req.user.id,
			});
		}

		if (!contact) {
			return res.status(404).json({
				success: false,
				msg: 'Contact not found',
			});
		}

		contact.isActive = false;
		await contact.save();

		return res.status(200).json({
			success: true,
			msg: 'Contact deleted successfully',
		});
	} catch (error) {
		console.error('Delete Contact Error:', error);

		return res.status(500).json({
			success: false,
			msg: 'Server error while deleting contact',
		});
	}
};

// =======================================================================================
// Admin Area
// =========================================================================================

const getAllContacts = async (req, res) => {
	try {
		const { page, limit, search, archived } = parseListQuery(req);
		const filter = { isActive: true, ...archiveMatch(archived) };
		if (req.query.account) filter.account = req.query.account;
		if (req.query.owner) filter.contactOwner = req.query.owner;
		if (search) {
			filter.$or = [
				{ firstName: regex(search) },
				{ lastName: regex(search) },
				{ email: regex(search) },
				{ phone: regex(search) },
				{ mobile: regex(search) },
				{ designation: regex(search) },
			];
		}
		const result = await paginate(Contact, {
			filter,
			page,
			limit,
			populate: [
				{ path: 'contactOwner', select: 'name email' },
				{ path: 'account', select: 'accountName' },
			],
		});
		return sendPage(res, result.data, result);
	} catch (err) {
		console.log(err);
		return res.status(500).json({ msg: 'Internal server error!!!' });
	}
};

const lookupContacts = async (req, res) => {
	try {
		const search = String(req.query.search || '').trim();
		const limit = Math.min(40, parseInt(req.query.limit, 10) || 20);
		const filter = { isActive: true, isArchived: { $ne: true } };
		if (req.query.account) filter.account = req.query.account;
		if (search) {
			filter.$or = [
				{ firstName: regex(search) },
				{ lastName: regex(search) },
				{ email: regex(search) },
				{ phone: regex(search) },
			];
		}
		const data = await Contact.find(filter)
			.populate('account', 'accountName')
			.populate('contactOwner', 'name')
			.sort({ firstName: 1, lastName: 1 })
			.limit(limit);
		return res.json({ success: true, data });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ msg: 'Internal server error!!!' });
	}
};

const archiveContact = async (req, res) => {
	try {
		const archived = req.body.archived !== false;
		const contact = await setArchived(Contact, {
			id: req.params.id,
			user: req.user,
			ownerField: 'contactOwner',
			archived,
		});
		if (!contact) {
			return res.status(404).json({ success: false, msg: 'Contact not found' });
		}
		return res.json({
			success: true,
			msg: archived ? 'Contact archived' : 'Contact restored',
			data: contact,
		});
	} catch (err) {
		console.error(err);
		return res.status(500).json({ msg: 'Internal server error!!!' });
	}
};

module.exports = {
	createContact,
	getMyContacts,
	getAllContacts,
	updateContact,
	deleteContact,
	lookupContacts,
	archiveContact,
};
