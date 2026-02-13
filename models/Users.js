const mongoose = require('mongoose');

const schema = mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
		},
		email: {
			type: String,
			required: true,
		},
		phone: {
			type: String,
			required: true,
		},
		designation: {
			type: String,
		},
		totalSell: {
			type: Number,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
		isSuperUser: {
			type: Boolean,
			default: false,
		},
		password: {
			type: String,
			required: true,
		},
	},
	{ timestamps: true }
);

const Users = mongoose.model('User', schema);

module.exports = Users;
