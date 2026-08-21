const mongoose = require('mongoose');

const JournalEntrySchema = new mongoose.Schema(
	{
		entryNumber: {
			type: String,
			required: true,
			unique: true,
			index: true,
		},
		date: {
			type: Date,
			required: true,
			index: true,
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
		status: {
			type: String,
			enum: ['draft', 'posted', 'void'],
			default: 'posted',
			index: true,
		},
		sourceType: {
			type: String,
			enum: [
				'invoice',
				'vendor_bill',
				'payment',
				'opening',
				'manual',
				'reversal',
			],
			required: true,
			index: true,
		},
		sourceId: {
			type: mongoose.Schema.Types.ObjectId,
			index: true,
		},
		narration: {
			type: String,
			required: true,
			trim: true,
			maxlength: 500,
		},
		postedAt: Date,
		postedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
		},
		voidedAt: Date,
		voidedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
		},
		voidReason: String,
		reversingEntry: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'JournalEntry',
		},
		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
		},
	},
	{ timestamps: true }
);

JournalEntrySchema.index(
	{ sourceType: 1, sourceId: 1, status: 1 },
	{
		unique: true,
		partialFilterExpression: { status: 'posted' },
	}
);
JournalEntrySchema.index({ status: 1, date: -1 });

module.exports = mongoose.model('JournalEntry', JournalEntrySchema);
