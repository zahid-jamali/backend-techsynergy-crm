const mongoose = require('mongoose');

const AttachmentSchema = new mongoose.Schema(
	{
		public_id: String,
		url: { type: String, required: true },
		originalName: String,
		mimeType: String,
		resourceType: { type: String, enum: ['image', 'raw'], default: 'raw' },
		bytes: Number,
	},
	{ _id: false }
);

const PriceQueryMessageSchema = new mongoose.Schema(
	{
		body: {
			type: String,
			trim: true,
			default: '',
			maxlength: 8000,
		},
		sender: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
			index: true,
		},
		threadOwner: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			index: true,
		},
		account: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Account',
			index: true,
		},
		replyTo: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'PriceQueryMessage',
		},
		senderRole: {
			type: String,
			enum: ['admin', 'staff', 'operations'],
			required: true,
		},
		attachments: {
			type: [AttachmentSchema],
			default: [],
		},
		isActive: {
			type: Boolean,
			default: true,
			index: true,
		},
	},
	{ timestamps: true }
);

PriceQueryMessageSchema.index({ isActive: 1, _id: -1 });
PriceQueryMessageSchema.index({ threadOwner: 1, isActive: 1, _id: -1 });

module.exports = mongoose.model('PriceQueryMessage', PriceQueryMessageSchema);
