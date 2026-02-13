import mongoose from 'mongoose';

const LeadSchema = new mongoose.Schema(
	{
		owner: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},

		name: {
			type: String,
			required: true,
			trim: true,
		},
		title: {
			type: String,
			trim: true,
		},

		email: {
			type: String,
			lowercase: true,
			trim: true,
		},
		phone: {
			type: String,
			trim: true,
		},
		mobile: {
			type: String,
			trim: true,
		},
		website: {
			type: String,
			trim: true,
		},

		company: {
			type: String,
			trim: true,
			required: true,
		},

		leadSource: {
			type: String,
			enum: [
				'None',
				'Advertisement',
				'Cold Call',
				'Employee Referral',
				'External Referral',
				'Online Store',
				'X (Twitter)',
				'Facebook',
				'Partner',
				'Public Relations',
				'Sales Email Alias',
				'Seminar Partner',
				'Internal Seminar',
				'Trade Show',
				'Web Download',
				'Web Research',
				'Chat',
			],
			default: 'None',
		},

		industry: {
			type: String,
			enum: [
				'ASP',
				'Data/Telecom OEM',
				'ERP',
				'Government/Military',
				'Large Enterprise',
				'Management ISV',
				'MSP',
				'Network Equipment Enterprise',
				'Non-management ISV',
				'Optical Networking',
				'Service Provider',
				'Small/Medium Enterprise',
				'Storage Equipment',
				'Storage Service Provider',
				'Systems Integrator',
				'Wireless Industry',
			],
		},

		status: {
			type: String,
			enum: [
				'Not Contacted',
				'Attempted to Contact',
				'Contacted',
				'Contact in Future',
				'Pre-Qualified',
				'Not Qualified',
				'Lost Lead',
				'Junk Lead',
			],
			default: 'Not Contacted',
		},

		rating: {
			type: String,
			enum: [
				'Acquired',
				'Active',
				'Market Failed',
				'Project Cancelled',
				'Shut Down',
			],
		},

		address: {
			street: { type: String, trim: true },
			city: { type: String, trim: true },
			country: { type: String, trim: true },
		},

		description: {
			type: String,
			trim: true,
		},

		isConverted: {
			type: Boolean,
			default: false,
		},
		convertedAt: {
			type: Date,
		},

		isArchived: {
			type: Boolean,
			default: false,
		},
	},
	{
		timestamps: true,
	}
);

export default mongoose.model('Lead', LeadSchema);
