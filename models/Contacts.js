// import mongoose from 'mongoose';
const mongoose = require('mongoose');

const { Schema } = mongoose;

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

		description: {
			type: String,
			trim: true,
		},
		designation: {
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
