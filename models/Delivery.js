const mongoose = require('mongoose');
const { Schema } = mongoose;

const FileSchema = new Schema(
	{
		public_id: String,
		url: String,
		originalName: String,
	},
	{ _id: false }
);

const DeliverySchema = new Schema(
	{
		deliveryNumber: {
			type: String,
			unique: true,
			index: true,
		},

		order: {
			type: Schema.Types.ObjectId,
			ref: 'Order',
			required: true,
			index: true,
		},

		status: {
			type: String,
			enum: ['draft', 'in_transit', 'delivered', 'forwarded_to_finance'],
			default: 'draft',
			index: true,
		},

		carrier: {
			type: String,
			trim: true,
		},

		trackingNumber: {
			type: String,
			trim: true,
		},

		remarks: {
			type: String,
			trim: true,
		},

		deliveryNote: FileSchema,

		supportingDocuments: {
			type: [FileSchema],
			default: [],
		},

		deliveredAt: Date,
		forwardedAt: Date,

		createdBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
		},

		forwardedBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
		},

		isActive: {
			type: Boolean,
			default: true,
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.model('Delivery', DeliverySchema);
