const Contact = require('../models/Contacts.js');
const mongoose = require('mongoose');

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
		const contacts = await Contact.find({
			contactOwner: req.user.id,
		}).populate('account');

		return res.status(200).json(contacts);
	} catch (err) {
		console.log(err);
		return res.status(500).json({ msg: 'Internal server error!!!' });
	}
};

const updateContact = async (req, res) => {
	try {
		const { id } = req.params;

		const contact = await Contact.findOne({
			_id: id,
			contactOwner: req.user.id,
		});

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

		const contact = await Contact.findOne({
			_id: id,
			contactOwner: req.user.id,
		});

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
		const contacts = await Contact.find().populate('contactOwner');

		return res.status(200).json(contacts);
	} catch (err) {
		console.log(err);
		return res.status(500).json({ msg: 'Internal server error!!!' });
	}
};

module.exports = {
	createContact,
	getMyContacts,
	getAllContacts,
	updateContact,
	deleteContact,
};
