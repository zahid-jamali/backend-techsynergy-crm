// import mongoose from 'mongoose';
const mongoose = require('mongoose');

const { Schema } = mongoose;

const AddressSchema = new Schema(
	{
		street: { type: String, trim: true },
		city: { type: String, trim: true },
		state: { type: String, trim: true },
		postalCode: { type: String, trim: true },
		country: { type: String, trim: true },
	},
	{ _id: false }
);

const ContactSchema = new Schema(
	{
		contactOwner: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
			index: true,
		},

		firstName: {
			type: String,
			trim: true,
		},

		lastName: {
			type: String,
			trim: true,
			index: true,
		},

		account: {
			type: Schema.Types.ObjectId,
			ref: 'Account',
			index: true,
		},

		email: {
			type: String,
			trim: true,
			lowercase: true,
			index: true,
		},

		phone: {
			type: String,
			trim: true,
		},

		mobile: {
			type: String,
			trim: true,
		},

		postalAddress: AddressSchema,

		description: {
			type: String,
			trim: true,
		},

		meta: {
			type: Map,
			of: Schema.Types.Mixed,
			default: {},
		},

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

ContactSchema.index({ email: 1, contactOwner: 1 });
ContactSchema.index({ firstName: 1, lastName: 1 });

const Contact = mongoose.model('Contact', ContactSchema);

module.exports = Contact;
