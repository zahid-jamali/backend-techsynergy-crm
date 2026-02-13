const Vendor = require('../models/Vendors');

const createVendor = async (req, res) => {
	try {
		const { name } = req.body;

		if (!name) {
			return res.status(400).json({
				success: false,
				msg: 'Vendor name is required',
			});
		}

		// Prevent duplicate vendor names
		const exists = await Vendor.findOne({
			name: name.trim(),
		});

		if (exists) {
			return res.status(400).json({
				success: false,
				msg: 'Vendor already exists',
			});
		}

		const vendor = await Vendor.create({
			...req.body,
			name: name.trim(),
			createdBy: req.user?.id,
		});

		return res.status(201).json({
			success: true,
			data: vendor,
		});
	} catch (error) {
		console.error('Create Vendor Error:', error);
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
