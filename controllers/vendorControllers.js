const Vendor = require('../models/Vendors');

const createVendor = async (req, res) => {
	try {
		let {
			name,
			code,
			contacts = [],
			addresses = [],
			bankDetails = {},
			notes,
		} = req.body;

		/* ================= VALIDATION ================= */

		if (!name || !name.trim()) {
			return res.status(400).json({
				success: false,
				msg: 'Vendor name is required',
			});
		}

		name = name.trim();

		/* ================= DUPLICATE CHECK ================= */

		const exists = await Vendor.findOne({
			name: new RegExp(`^${name}$`, 'i'), // case-insensitive
		});

		if (exists) {
			return res.status(400).json({
				success: false,
				msg: 'Vendor already exists',
			});
		}

		/* ================= CONTACTS NORMALIZATION ================= */

		if (Array.isArray(contacts)) {
			let primaryFound = false;

			contacts = contacts.map((c) => {
				const contact = {
					name: c.name?.trim(),
					email: c.email?.trim(),
					phone: c.phone?.trim(),
					designation: c.designation?.trim(),
					isPrimary: Boolean(c.isPrimary),
				};

				if (contact.isPrimary) {
					if (primaryFound) {
						contact.isPrimary = false; // allow only one primary
					}
					primaryFound = true;
				}

				return contact;
			});

			// If none marked primary, set first as primary
			if (!primaryFound && contacts.length > 0) {
				contacts[0].isPrimary = true;
			}
		}

		/* ================= ADDRESSES NORMALIZATION ================= */

		if (Array.isArray(addresses)) {
			addresses = addresses.map((a) => ({
				type: a.type || 'Office',
				addressLine1: a.addressLine1?.trim(),
				addressLine2: a.addressLine2?.trim(),
				city: a.city?.trim(),
				state: a.state?.trim(),
				country: a.country?.trim(),
				postalCode: a.postalCode?.trim(),
			}));
		}

		/* ================= BANK DETAILS NORMALIZATION ================= */

		if (bankDetails) {
			bankDetails = {
				accountTitle: bankDetails.accountTitle?.trim(),
				accountNumber: bankDetails.accountNumber?.trim(),
				bankName: bankDetails.bankName?.trim(),
				iban: bankDetails.iban?.trim(),
				branch: bankDetails.branch?.trim(),
			};
		}

		/* ================= CODE GENERATION (OPTIONAL) ================= */

		if (code) {
			code = code.trim().toUpperCase();
		}

		/* ================= CREATE ================= */

		const vendor = await Vendor.create({
			name,
			code,
			contacts,
			addresses,
			bankDetails,
			notes,
			createdBy: req.user?.id,
		});

		return res.status(201).json({
			success: true,
			data: vendor,
		});
	} catch (error) {
		console.error('Create Vendor Error:', error);

		/* Handle duplicate code error */
		if (error.code === 11000) {
			return res.status(400).json({
				success: false,
				msg: 'Vendor code already exists',
			});
		}

		return res.status(500).json({
			success: false,
			msg: 'Failed to create vendor',
		});
	}
};


const getVendors = async (req, res) => {
	try {
		const vendors = await Vendor.find().sort({ createdAt: -1 }).lean();

		return res.status(200).json({
			success: true,
			data: vendors,
		});
	} catch (error) {
		console.error('Get Vendors Error:', error);
		return res.status(500).json({
			success: false,
			msg: 'Failed to fetch vendors',
		});
	}
};

const updateVendor = async (req, res) => {
	try {
		const { id } = req.params;

		const vendor = await Vendor.findById(id);

		if (!vendor) {
			return res.status(404).json({
				success: false,
				msg: 'Vendor not found',
			});
		}

		// Prevent name collision
		if (req.body.name && req.body.name !== vendor.name) {
			const exists = await Vendor.findOne({
				name: req.body.name.trim(),
			});

			if (exists) {
				return res.status(400).json({
					success: false,
					msg: 'Another vendor with this name already exists',
				});
			}
		}

		Object.assign(vendor, req.body);
		await vendor.save();

		return res.status(200).json({
			success: true,
			data: vendor,
		});
	} catch (error) {
		console.error('Update Vendor Error:', error);
		return res.status(500).json({
			success: false,
			msg: 'Failed to update vendor',
		});
	}
};

const deleteVendor = async (req, res) => {
	try {
		const { id } = req.params;

		const vendor = await Vendor.findByIdAndDelete(id);

		if (!vendor) {
			return res.status(404).json({
				success: false,
				msg: 'Vendor not found',
			});
		}

		return res.status(200).json({
			success: true,
			msg: 'Vendor deleted successfully',
		});
	} catch (error) {
		console.error('Delete Vendor Error:', error);
		return res.status(500).json({
			success: false,
			msg: 'Failed to delete vendor',
		});
	}
};

module.exports = {
	createVendor,
	getVendors,
	updateVendor,
	deleteVendor,
};
