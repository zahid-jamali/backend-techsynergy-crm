const mongoose = require('mongoose');

const { Schema } = mongoose;

const DealSchema = new Schema(
	{
		dealOwner: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
			index: true,
		},

		dealName: {
			type: String,
			required: true,
			trim: true,
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
			index: true,
		},

		dealType: {
			type: String,
			enum: ['-None-', 'Existing Business', 'New Business'],
			default: '-None-',
			index: true,
		},

		stage: {
			type: String,
			enum: [
				'Qualification',
				'Needs Analysis',
				'Value Proposition',
				'Identify Decision Makers',
				'Proposal/Price Quote',
				'Negotiation/Review',
				'Closed Won',
				'Closed Lost',
				'Closed Lost to Competition',
			],
			default: 'Qualification',
			index: true,
		},

		nextStep: {
			type: String,
			trim: true,
		},

		previousStep: {
			type: String,
			trim: true,
		},

		amount: {
			type: Number,
			min: 0,
			default: 0,
		},
		currency: {
			type: String,
			enum: ['USD', 'PKR'],
			default: 'PKR',
		},

		probability: {
			type: Number,
			min: 0,
			max: 100,
			default: 0,
		},

		expectedRevenue: {
			type: Number,
			min: 0,
			default: 0,
		},

		closingDate: {
			type: Date,
			index: true,
		},

		description: {
			type: String,
			trim: true,
		},

		meta: {
			type: Map,
			of: Schema.Types.Mixed,
			default: {},
		},

		/* 🔹 Soft Status */
		isActive: {
			type: Boolean,
			default: true,
			index: true,
		},
	},
	{
		timestamps: true,
	}
);

DealSchema.pre('save', function () {
	this.expectedRevenue = Math.round((this.amount * this.probability) / 100);
});

/* 🔹 Indexes for reporting & dashboards */
DealSchema.index({ dealOwner: 1, stage: 1 });
DealSchema.index({ account: 1, closingDate: 1 });
DealSchema.index({ expectedRevenue: -1 });

const Deals = mongoose.model('Deal', DealSchema);

module.exports = Deals;
