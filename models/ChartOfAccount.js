const mongoose = require('mongoose');

const ChartOfAccountSchema = new mongoose.Schema(
	{
		code: {
			type: String,
			required: true,
			trim: true,
			unique: true,
			index: true,
		},
		name: {
			type: String,
			required: true,
			trim: true,
		},
		type: {
			type: String,
			enum: ['asset', 'liability', 'equity', 'income', 'expense'],
			required: true,
			index: true,
		},
		normalBalance: {
			type: String,
			enum: ['debit', 'credit'],
			required: true,
		},
		isSystem: {
			type: Boolean,
			default: false,
		},
		isPostable: {
			type: Boolean,
			default: true,
		},
		parent: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'ChartOfAccount',
		},
		currencyHint: {
			type: String,
			enum: ['PKR', 'USD', 'any'],
			default: 'any',
		},
		isActive: {
			type: Boolean,
			default: true,
			index: true,
		},
		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
		},
	},
	{ timestamps: true }
);

ChartOfAccountSchema.index({ type: 1, isActive: 1 });

module.exports = mongoose.model('ChartOfAccount', ChartOfAccountSchema);
