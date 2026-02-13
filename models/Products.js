const mongoose = require('mongoose');

const schema = mongoose.Schema({
	title: {
		type: String,
		required: true,
	},
	currency: {
		type: String,
		enum: ['USD', 'PKR'],
		default: 'PKR',
	},

	previousQuotePrice: {
		type: Number,
	},

	previousVendorPrice: {
		type: Number,
	},
});

const Product = mongoose.model('Product', schema);

module.exports = Product;
