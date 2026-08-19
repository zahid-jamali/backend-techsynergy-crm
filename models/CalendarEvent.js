const mongoose = require('mongoose');
const { Schema } = mongoose;

const CalendarEventSchema = new Schema(
	{
		title: {
			type: String,
			required: true,
			trim: true,
		},
		description: {
			type: String,
			trim: true,
			default: '',
		},
		start: {
			type: Date,
			required: true,
			index: true,
		},
		end: {
			type: Date,
		},
		allDay: {
			type: Boolean,
			default: true,
		},
		color: {
			type: String,
			enum: ['brand', 'emerald', 'amber', 'violet', 'sky'],
			default: 'brand',
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

module.exports = mongoose.model('CalendarEvent', CalendarEventSchema);
