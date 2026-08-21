const mongoose = require('mongoose');

const AllocationSchema = new mongoose.Schema(
	{
		documentType: {
			type: String,
			enum: ['invoice', 'vendor_bill'],
			required: true,
		},
		documentId: {
			type: mongoose.Schema.Types.ObjectId,
			required: true,
		},
		amount: {
			type: Number,
			required: true,
			min: 0.01,
		},
	},
	{ _id: false }
);

const PaymentSchema = new mongoose.Schema(
	{
		paymentNumber: {
			type: String,
			required: true,
			unique: true,
			index: true,
		},
		direction: {
			type: String,
			enum: ['inbound', 'outbound'],
			required: true,
			index: true,
		},
		partyType: {
			type: String,
			enum: ['customer', 'vendor'],
			required: true,
			index: true,
		},
		partyId: {
			type: mongoose.Schema.Types.ObjectId,
			required: true,
			index: true,
		},
		method: {
			type: String,
			enum: ['cash', 'bank', 'cheque', 'online'],
			required: true,
		},
		cashAccountCode: {
			type: String,
			enum: ['1100', '1110', '1120'],
			default: '1110',
		},
		date: {
			type: Date,
			required: true,
		},
		amount: {
			type: Number,
			required: true,
			min: 0.01,
		},
		currency: {
			type: String,
			enum: ['USD', 'PKR'],
			required: true,
		},
		fxRateToPKR: {
			type: Number,
			required: true,
			min: 0,
			default: 1,
		},
		bankReference: String,
		chequeNumber: String,
		notes: String,
		attachment: {
			public_id: String,
			url: String,
			originalName: String,
		},
		allocations: {
			type: [AllocationSchema],
			default: [],
		},
		unallocatedAmount: {
			type: Number,
			default: 0,
			min: 0,
		},
		status: {
			type: String,
			enum: ['draft', 'posted', 'void'],
			default: 'draft',
			index: true,
		},
		journalEntry: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'JournalEntry',
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
		voidedAt: Date,
		voidedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
		},
	},
	{ timestamps: true }
);

PaymentSchema.index({ partyType: 1, partyId: 1, date: -1 });
PaymentSchema.index({ status: 1, direction: 1 });
PaymentSchema.index({ 'allocations.documentId': 1 });

module.exports = mongoose.model('Payment', PaymentSchema);
