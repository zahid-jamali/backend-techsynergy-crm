const mongoose = require('mongoose');

const VendorBillLineSchema = new mongoose.Schema(
	{
		productName: { type: String, required: true, trim: true },
		quantity: { type: Number, min: 1, default: 1 },
		listPrice: { type: Number, min: 0, required: true },
		amount: { type: Number, default: 0 },
		total: { type: Number, default: 0 },
	},
	{ _id: false }
);

const VendorBillSchema = new mongoose.Schema(
	{
		billNumber: {
			type: String,
			required: true,
			unique: true,
			index: true,
		},
		vendor: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Vendor',
			required: true,
			index: true,
		},
		poToVendor: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'POToVendor',
			index: true,
		},
		order: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Order',
		},
		quote: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Quote',
		},
		vendorBillRef: {
			type: String,
			trim: true,
		},
		billDate: {
			type: Date,
			required: true,
		},
		dueDate: Date,
		currency: {
			type: String,
			enum: ['USD', 'PKR'],
			default: 'PKR',
		},
		fxRateToPKR: {
			type: Number,
			required: true,
			min: 0,
			default: 1,
		},
		lines: {
			type: [VendorBillLineSchema],
			default: [],
		},
		subtotal: {
			type: Number,
			default: 0,
			min: 0,
		},
		grandTotal: {
			type: Number,
			default: 0,
			min: 0,
		},
		description: String,
		status: {
			type: String,
			enum: ['draft', 'posted', 'cancelled'],
			default: 'draft',
			index: true,
		},
		journalEntry: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'JournalEntry',
		},
		attachment: {
			public_id: String,
			url: String,
			originalName: String,
		},
		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
		},
		postedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
		},
		postedAt: Date,
		isActive: {
			type: Boolean,
			default: true,
		},
	},
	{ timestamps: true }
);

VendorBillSchema.index({ vendor: 1, billDate: -1 });
VendorBillSchema.index({ status: 1, vendor: 1 });

module.exports = mongoose.model('VendorBill', VendorBillSchema);
