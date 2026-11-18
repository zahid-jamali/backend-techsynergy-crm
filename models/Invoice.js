const mongoose = require('mongoose');
const { Schema } = mongoose;

const LineSchema = new Schema(
	{
		productName: { type: String, trim: true, required: true },
		description: { type: String, trim: true },
		hsCode: { type: String, trim: true, default: '' },
		uoM: { type: String, trim: true, default: 'Numbers, pieces, units' },
		quantity: { type: Number, min: 0, default: 1 },
		unitPrice: { type: Number, min: 0, default: 0 },
		discount: { type: Number, min: 0, default: 0 },
		fixedNotifiedValue: { type: Number, min: 0, default: 0 },
		extraTax: { type: Number, min: 0, default: 0 },
		fedPayable: { type: Number, min: 0, default: 0 },
		salesTaxWithheldAtSource: { type: Number, min: 0, default: 0 },
		// computed by lib/fbr/tax.computeLine
		gross: { type: Number, default: 0 },
		valueExclST: { type: Number, default: 0 },
		salesTax: { type: Number, default: 0 },
		furtherTax: { type: Number, default: 0 },
		total: { type: Number, default: 0 },
		fbrItemInvoiceNo: { type: String, trim: true },
	},
	{ _id: false }
);

const BuyerSchema = new Schema(
	{
		businessName: { type: String, trim: true },
		ntnCnic: { type: String, trim: true, default: '' },
		strn: { type: String, trim: true, default: '' },
		registrationType: {
			type: String,
			enum: ['Registered', 'Unregistered'],
			default: 'Unregistered',
		},
		province: { type: String, trim: true, default: '' },
		address: { type: String, trim: true, default: '' },
		contactName: { type: String, trim: true },
		phone: { type: String, trim: true },
		email: { type: String, trim: true },
	},
	{ _id: false }
);

const TaxSchema = new Schema(
	{
		saleTypeKey: { type: String, default: 'standard' },
		saleType: { type: String, default: 'Goods at standard rate (default)' },
		rate: { type: String, default: '18%' },
		sroScheduleNo: { type: String, default: '' },
		sroItemSerialNo: { type: String, default: '' },
		furtherTaxPercent: { type: Number, min: 0, default: 0 },
		extraTaxBlank: { type: Boolean, default: false },
		retailToEndConsumer: { type: Boolean, default: false },
	},
	{ _id: false }
);

const FbrSchema = new Schema(
	{
		status: {
			type: String,
			enum: ['not_submitted', 'validated', 'submitted', 'failed'],
			default: 'not_submitted',
			index: true,
		},
		environment: { type: String, enum: ['sandbox', 'production'] },
		scenarioId: { type: String },
		irn: { type: String, index: true },
		dated: { type: String },
		submittedAt: Date,
		submittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
		lastValidatedAt: Date,
		lastErrorCode: String,
		lastError: String,
		attempts: { type: Number, default: 0 },
	},
	{ _id: false }
);

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

		dueDate: Date,
		paymentTerms: { type: String, trim: true, default: 'Net 30' },

		customerRefNo: {
			type: String,
			trim: true,
		},

		description: {
			type: String,
			trim: true,
		},

		notes: { type: String, trim: true },

		buyer: { type: BuyerSchema, default: () => ({}) },
		tax: { type: TaxSchema, default: () => ({}) },
		lines: { type: [LineSchema], default: [] },

		totals: {
			gross: { type: Number, default: 0 },
			discount: { type: Number, default: 0 },
			valueExclST: { type: Number, default: 0 },
			salesTax: { type: Number, default: 0 },
			furtherTax: { type: Number, default: 0 },
			extraTax: { type: Number, default: 0 },
			fedPayable: { type: Number, default: 0 },
			withheld: { type: Number, default: 0 },
			total: { type: Number, default: 0 },
		},

		exchangeRate: { type: Number, min: 0, default: 1 },

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

		fbr: { type: FbrSchema, default: () => ({}) },

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
		cancelledAt: Date,
		cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
		cancelReason: { type: String, trim: true },
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
