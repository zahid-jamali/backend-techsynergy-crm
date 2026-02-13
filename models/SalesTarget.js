const mongoose = require('mongoose');

const schema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},

		month: {
			type: Number, // 1 - 12
			required: true,
		},

		year: {
			type: Number,
			required: true,
		},

		targetAmount: {
			type: Number,
			required: true,
		},

		forecastAmount: {
			type: Number,
			default: 0,
		},
	},
	{ timestamps: true }
);

schema.index({ user: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('SalesTarget', schema);
