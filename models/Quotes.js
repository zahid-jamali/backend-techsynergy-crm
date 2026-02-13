const mongoose = require('mongoose');

const { Schema } = mongoose;

const QuoteProductSchema = new Schema(
	{
		serialNo: Number,

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
			default: 0, // calculated in controller
		},

		discount: {
			type: Number,
			default: 0,
		},

		total: {
			type: Number,
			default: 0, // calculated in controller
		},
	},
	{ _id: false }
);

const QuoteSchema = new Schema(
	{
		quoteOwner: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
			index: true,
		},
		quoteNumber: {
			type: String,
			unique: true,
		},

		subject: {
			type: String,
			required: true,
			trim: true,
			index: true,
		},

		quoteStage: {
			type: String,
			enum: [
				'Draft',
				'Negotiation',
				'Delivered',
				'On Hold',
				'Confirmed',
				'Closed Won',
				'Closed Lost',
			],
			default: 'Draft',
			index: true,
		},
		purchaseOrder: {
			public_id: { type: String },
			url: { type: String },
		},
		isSOApproved: {
			type: Boolean,
			default: false,
		},
		confirmedDate: {
			type: Date,
			required: false,
		},

		nextStep: { type: String },

		deal: {
			type: Schema.Types.ObjectId,
			ref: 'Deal',
			required: true,
			index: true,
		},

		account: {
			type: Schema.Types.ObjectId,
			ref: 'Account',
			required: true,
			index: true,
		},

		contact: {
			type: Schema.Types.ObjectId,
			ref: 'Contact',
		},

		validUntil: Date,
		termsAndConditions: [
			{
				type: String,
			},
		],

		currency: {
			type: String,
			enum: ['USD', 'PKR'],
			default: 'PKR',
		},

		products: {
			type: [QuoteProductSchema],
			default: [],
		},

		/* -------- GST (QUOTE LEVEL ONLY) -------- */
		isGstApplied: {
			type: Boolean,
			default: false,
		},

		gstRate: {
			type: Number,
			default: 18, // fixed, controller uses this
		},

		gstAmount: {
			type: Number,
			default: 0, // controller calculate karega
		},

		/* -------- Totals (controller calculated) -------- */
		subTotal: {
			type: Number,
			default: 0,
		},

		discountTotal: {
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

/* ---------------- Indexes ---------------- */
QuoteSchema.index({ deal: 1, quoteStage: 1 });
QuoteSchema.index({ account: 1, createdAt: -1 });

const Quote = mongoose.model('Quote', QuoteSchema);
module.exports = Quote;
