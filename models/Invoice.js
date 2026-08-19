const mongoose = require('mongoose');
const { Schema } = mongoose;

const InvoiceSchema = new Schema(
	{
		invoiceNumber: {
			type: String,
			required: true,
			unique: true,
			index: true,
		},

		order: {
			type: Schema.Types.ObjectId,
			ref: 'Order',
			required: true,
			index: true,
		},

		delivery: {
			type: Schema.Types.ObjectId,
			ref: 'Delivery',
		},

		documentDate: {
			type: Date,
			required: true,
			default: Date.now,
		},

		customerRefNo: {
			type: String,
			trim: true,
		},

		description: {
			type: String,
			trim: true,
		},

		subtotal: {
			type: Number,
			default: 0,
		},

		grandTotal: {
			type: Number,
			default: 0,
		},

		currency: {
			type: String,
			enum: ['USD', 'PKR'],
			default: 'PKR',
		},

		transportation: {
			included: {
				type: Boolean,
				default: false,
			},
			amount: {
				type: Number,
				default: 0,
				min: 0,
			},
		},

		termsAndConditions: [
			{
				type: String,
				trim: true,
			},
		],

		status: {
			type: String,
			enum: ['Draft', 'Issued', 'Cancelled'],
			default: 'Draft',
			index: true,
		},

		issuedAt: Date,
		issuedBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
		},
		createdBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
		},

		isActive: {
			type: Boolean,
			default: true,
		},
	},
	{
		timestamps: true,
	}
);

module.exports = mongoose.model('Invoice', InvoiceSchema);
