const mongoose = require('mongoose');
const { Schema } = mongoose;

/** Audit trail of every call made to the FBR DI API. */
const FbrSubmissionSchema = new Schema(
	{
		invoice: { type: Schema.Types.ObjectId, ref: 'Invoice', index: true },
		scenarioId: { type: String, index: true },
		source: { type: String, enum: ['invoice', 'scenario_test'], default: 'invoice' },
		mode: { type: String, enum: ['validate', 'post'], required: true },
		environment: { type: String, enum: ['sandbox', 'production'], required: true },
		ok: { type: Boolean, default: false, index: true },
		httpStatus: Number,
		irn: String,
		dated: String,
		statusCode: String,
		errorCode: String,
		error: String,
		itemErrors: { type: Array, default: [] },
		request: Schema.Types.Mixed,
		response: Schema.Types.Mixed,
		durationMs: Number,
		createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
	},
	{ timestamps: true }
);

module.exports = mongoose.model('FbrSubmission', FbrSubmissionSchema);
