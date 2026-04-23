const mongoose = require('mongoose');
const { Schema } = mongoose;

const ProductSchema = new Schema(
	{
		productName: {
			type: String,
			required: true,
			trim: true,
		},

		description: {
			type: String,
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

const OrderSchema = new Schema(
	{
		orderNumber: {
			type: String,
			unique: true,
			index: true,
		},

		finalQuote: {
			type: Schema.Types.ObjectId,
			ref: 'Quote',
			required: true,
			index: true,
		},

		products: {
			type: [ProductSchema],
			default: [],
		},

		purchaseOrder: {
			public_id: String,
			url: String,
		},

		confirmedDate: {
			type: Date,
		},

		invoiceTermsAndConditions:[{
			type:String,
		}],

		Tax: [
			{
				tax: {
					type: String,
					required: true,
					trim: true,
				},
				percent: {
					type: Number,
					min: 0,
					default: 0,
				},
			},
		],

		status: {
			type: String,
			enum: ['Accepted', 'Rejected', 'Pending'],
			default: 'Pending',
		},
		currency: {
			type: String,
			enum: ['USD', 'PKR'],
			default: 'PKR',
		},

		isSOApproved: {
			type: Boolean,
			default: false,
		},

		subtotal: Number,
		tax: Number,
		discount: Number,
		grandTotal: Number,

		createdBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
		},
		isActive: {
			type: Boolean,
			default: true,
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.model('Order', OrderSchema);
