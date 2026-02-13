const Product = require('../models/Products');

const createProduct = async (req, res) => {
	try {
		const { title, previousQuotePrice, previousVenderPrice } = req.body;

		if (!title) {
			return res.status(400).json({
				success: false,
				msg: 'Product title is required',
			});
		}

		const product = await Product.create({
			title,
			previousQuotePrice,
			previousVenderPrice,
		});

		return res.status(201).json({
			success: true,
			data: product,
		});
	} catch (error) {
		console.error('Create Product Error:', error);
		return res.status(500).json({
			success: false,
			msg: 'Failed to create product',
		});
	}
};

const getProducts = async (req, res) => {
	try {
		const products = await Product.find().sort({ createdAt: -1 });

		return res.status(200).json({
			success: true,
			data: products,
		});
	} catch (error) {
		console.error('Get Products Error:', error);
		return res.status(500).json({
			success: false,
			msg: 'Failed to fetch products',
		});
	}
};

const deleteProduct = async (req, res) => {
	try {
		const { id } = req.params;

		const product = await Product.findByIdAndDelete(id);

		if (!product) {
			return res.status(404).json({
				success: false,
				msg: 'Product not found',
			});
		}

		return res.status(200).json({
			success: true,
			msg: 'Product deleted successfully',
		});
	} catch (error) {
		console.error('Delete Product Error:', error);
		return res.status(500).json({
			success: false,
			msg: 'Failed to delete product',
		});
	}
};

module.exports = {
	createProduct,
	getProducts,
	deleteProduct,
};
