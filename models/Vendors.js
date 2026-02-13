const mongoose = require('mongoose');

const VendorSchema = new mongoose.Schema(
	{
		/* ================= BASIC INFO ================= */
		name: {
			type: String,
			required: true,
			trim: true,
			index: true,
		},

		code: {
			type: String,
			unique: true,
			sparse: true, // optional but unique if present
		},

		status: {
			type: String,
			enum: ['Active', 'Inactive', 'Blacklisted'],
			default: 'Active',
		},

		/* ================= CONTACT INFO ================= */
		contacts: [
			{
				name: { type: String },
				email: { type: String },
				phone: { type: String },
				designation: { type: String },
				isPrimary: { type: Boolean, default: false },
			},
		],

		/* ================= ADDRESSES ================= */
		addresses: [
			{
				type: {
					type: String,
					enum: ['Billing', 'Shipping', 'Office'],
					default: 'Office',
				},
				addressLine1: { type: String },
				addressLine2: { type: String },
				city: { type: String },
				state: { type: String },
				country: { type: String },
				postalCode: { type: String },
			},
		],

		/* ================= TAX & LEGAL ================= */
		taxInfo: {
			gstNumber: { type: String },
			ntnNumber: { type: String },
			isTaxRegistered: { type: Boolean, default: false },
		},

		/* ================= BANK DETAILS ================= */
		bankDetails: {
			accountTitle: { type: String },
			accountNumber: { type: String },
			bankName: { type: String },
			iban: { type: String },
			branch: { type: String },
		},

		/* ================= METRICS ================= */
		stats: {
			totalPurchase: { type: Number, default: 0 },
			totalOrders: { type: Number, default: 0 },
			lastOrderDate: { type: Date },
		},

		/* ================= SYSTEM ================= */
		notes: { type: String },
		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
		},
	},
	{
		timestamps: true,
	}
);

module.exports = mongoose.model('Vendor', VendorSchema);
