const mongoose = require('mongoose');

const JournalPostingFailureSchema = new mongoose.Schema(
	{
		sourceType: {
			type: String,
			required: true,
			index: true,
		},
		sourceId: {
			type: mongoose.Schema.Types.ObjectId,
			required: true,
			index: true,
		},
		action: {
			type: String,
			enum: ['issue', 'cancel', 'vendor_bill_post', 'vendor_bill_cancel', 'payment_post', 'payment_void', 'manual'],
			required: true,
		},
		status: {
			type: String,
			enum: ['open', 'resolved', 'skipped'],
			default: 'open',
			index: true,
		},
		lastError: {
			type: String,
			required: true,
		},
		errorName: String,
		retryCount: {
			type: Number,
			default: 0,
			min: 0,
		},
		lastAttemptAt: {
			type: Date,
			default: Date.now,
		},
		resolvedAt: Date,
		resolvedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
		},
		journalEntry: {
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

JournalPostingFailureSchema.index({ sourceType: 1, sourceId: 1 }, { unique: true });
JournalPostingFailureSchema.index({ status: 1, updatedAt: -1 });

module.exports = mongoose.model(
	'JournalPostingFailure',
	JournalPostingFailureSchema
);
