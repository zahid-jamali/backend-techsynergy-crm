const mongoose = require('mongoose');

const PartyBalanceSchema = new mongoose.Schema(
	{
		partyType: {
			type: String,
			enum: ['customer', 'vendor'],
			required: true,
		},
		partyId: {
			type: mongoose.Schema.Types.ObjectId,
			required: true,
		},
		currency: {
			type: String,
			enum: ['USD', 'PKR'],
			required: true,
		},
		debitTotal: { type: Number, default: 0 },
		creditTotal: { type: Number, default: 0 },
		balance: { type: Number, default: 0 },
		asOf: Date,
	},
	{ timestamps: true }
);

PartyBalanceSchema.index(
	{ partyType: 1, partyId: 1, currency: 1 },
	{ unique: true }
);

module.exports = mongoose.model('PartyBalance', PartyBalanceSchema);
