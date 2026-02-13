const mongoose = require('mongoose');
const { Schema } = mongoose;

const POToVendorSchema = new Schema(
	{
		serialNo: Number,

		productName: {
			type: String,
			required: true,
			trim: true,
		},

		quantity: {
			type: Number,
			min: 1,
			default: 1,
		},

		listPrice: {
			type: Number,
			min: 0,
			required: true,
		},

		amount: {
			type: Number,
			default: 0,
		},

		total: {
			type: Number,
			default: 0,
		},
	},
	{ _id: false }
);

const schema = new Schema(
	{
		poToNumber: {
			type: String,
			unique: true,
		},

		subject: {
			type: String,
			required: true,
			trim: true,
			index: true,
		},

		refQuote: {
			type: mongoose.Schema.ObjectId,
			ref: 'Quote',
		},
		vendor: {
			type: mongoose.Schema.ObjectId,
			ref: 'Vendor',
		},

		validUntil: Date,
		termsAndConditions: [
			{
				type: String,
			},
		],

		products: {
			type: [POToVendorSchema],
			default: [],
		},

		isGstApplied: {
			type: Boolean,
			default: false,
		},

		gstRate: {
			type: Number,
			default: 18,
		},

		gstAmount: {
			type: Number,
			default: 0,
		},

		subTotal: {
			type: Number,
			default: 0,
		},

		grandTotal: {
			type: Number,
			default: 0,
		},

		description: {
			type: String,
			trim: true,
		},

		isActive: {
			type: Boolean,
			default: true,
			index: true,
		},
	},
	{ timestamps: true }
);

const POToVendor = mongoose.model('POToVendor', schema);
module.exports = POToVendor;
