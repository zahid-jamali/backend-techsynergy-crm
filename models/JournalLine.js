const mongoose = require('mongoose');

const JournalLineSchema = new mongoose.Schema(
	{
		journalEntry: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'JournalEntry',
			required: true,
			index: true,
		},
		lineNo: {
			type: Number,
			required: true,
			min: 1,
		},
		ledgerAccount: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'ChartOfAccount',
			required: true,
			index: true,
		},
		partyType: {
			type: String,
			enum: ['customer', 'vendor', 'none'],
			default: 'none',
			index: true,
		},
		partyId: {
			type: mongoose.Schema.Types.ObjectId,
			index: true,
		},
		debit: {
			type: Number,
			default: 0,
			min: 0,
		},
		credit: {
			type: Number,
			default: 0,
			min: 0,
		},
		amountPKR: {
			type: Number,
			default: 0,
		},
		narration: {
			type: String,
			trim: true,
		},
		date: {
			type: Date,
			required: true,
			index: true,
		},
		status: {
			type: String,
			enum: ['draft', 'posted', 'void'],
			default: 'posted',
			index: true,
		},
		sourceType: {
			type: String,
			index: true,
		},
		sourceId: {
			type: mongoose.Schema.Types.ObjectId,
			index: true,
		},
		entryNumber: String,
		currency: {
			type: String,
			enum: ['USD', 'PKR'],
		},
		fxRateToPKR: Number,
	},
	{ timestamps: true }
);

JournalLineSchema.index({ journalEntry: 1, lineNo: 1 }, { unique: true });
JournalLineSchema.index({ partyType: 1, partyId: 1, date: 1, _id: 1 });
JournalLineSchema.index({ ledgerAccount: 1, date: 1, _id: 1 });
JournalLineSchema.index({ sourceType: 1, sourceId: 1, status: 1 });

module.exports = mongoose.model('JournalLine', JournalLineSchema);
