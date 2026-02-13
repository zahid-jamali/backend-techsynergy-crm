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

		sellOrder: {
			type: Schema.Types.ObjectId,
			ref: 'Quote',
			required: true,
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
