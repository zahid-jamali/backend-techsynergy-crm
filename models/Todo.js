const mongoose = require('mongoose');
const { Schema } = mongoose;

const TodoSchema = new Schema(
	{
		title: {
			type: String,
			required: true,
			trim: true,
		},
		notes: {
			type: String,
			trim: true,
			default: '',
		},
		status: {
			type: String,
			enum: ['open', 'in_progress', 'done'],
			default: 'open',
			index: true,
		},
		priority: {
			type: String,
			enum: ['low', 'medium', 'high'],
			default: 'medium',
		},
		dueDate: {
			type: Date,
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

module.exports = mongoose.model('Todo', TodoSchema);
