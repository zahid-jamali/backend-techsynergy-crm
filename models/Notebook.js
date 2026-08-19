const mongoose = require('mongoose');
const { Schema } = mongoose;

const NotebookSchema = new Schema(
	{
		title: {
			type: String,
			required: true,
			trim: true,
			default: 'Untitled note',
		},
		content: {
			type: String,
			default: '',
		},
		visibility: {
			type: String,
			enum: ['private', 'public'],
			default: 'private',
			index: true,
		},
		pinned: {
			type: Boolean,
			default: false,
		},
		createdBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
			index: true,
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.model('Notebook', NotebookSchema);
