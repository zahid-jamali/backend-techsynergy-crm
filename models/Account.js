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

const AccountSchema = new Schema(
  {
    accountOwner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    accountName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    accountSite: {
      type: String,
      trim: true,
    },

    accountType: {
      type: String,
      enum: [
        'Analyst',
        'Competitor',
        'Customer',
        'Distributor',
        'Integrator',
        'Investor',
        'Other',
        'Partner',
        'Press',
        'Prospect',
        'Reseller',
        'Supplier',
        'Vendor',
      ],
      default: 'Customer',
      index: true,
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
        'Financial Services',
        'Education',
        'Technology',
        'Real Estate',
        'Consulting',
        'Communications',
        'Manufacturing',
      ],
      index: true,
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
      default: 'Active',
    },

    ownership: {
      type: String,
      enum: [
        '-None-',
        'Other',
        'Private',
        'Public',
        'Subsidiary',
        'Partnership',
        'Government',
        'Privately Held',
        'Public Company',
      ],
      default: '-None-',
    },

    annualRevenue: {
      type: Number,
      min: 0,
    },

    phone: {
      type: String,
      trim: true,
    },

    website: {
      type: String,
      trim: true,
      lowercase: true,
    },

    billingAddress: AddressSchema,
    shippingAddress: AddressSchema,

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

AccountSchema.index({ accountName: 1, accountOwner: 1 });

const Account = mongoose.model('Account', AccountSchema);

module.exports = Account;
