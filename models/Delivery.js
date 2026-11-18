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

		dispatchDate: Date,
		vehicleNumber: { type: String, trim: true },
		driverName: { type: String, trim: true },
		driverPhone: { type: String, trim: true },
		packages: { type: Number, min: 0 },
		receivedBy: { type: String, trim: true },
		receiverPhone: { type: String, trim: true },

		shipTo: {
			name: { type: String, trim: true },
			address: { type: String, trim: true },
			contactName: { type: String, trim: true },
			phone: { type: String, trim: true },
		},

		items: {
			type: [
				new Schema(
					{
						productName: { type: String, trim: true, required: true },
						description: { type: String, trim: true },
						uoM: { type: String, trim: true, default: 'Units' },
						orderedQty: { type: Number, min: 0, default: 0 },
						deliveredQty: { type: Number, min: 0, default: 0 },
						remarks: { type: String, trim: true },
					},
					{ _id: false }
				),
			],
			default: [],
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
