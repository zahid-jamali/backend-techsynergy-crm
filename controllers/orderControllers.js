const Order = require('../models/Order');
const Quote = require('../models/Quotes');
const getNextSequence = require('../lib/getNextSequence.js');
const User = require('../models/Users');
const Deals = require('../models/Deals');

const createOrderFromConfirmedQuote = async (req, res) => {
	try {
		let {
			quoteId,
			products: orderProducts,
			otherTax: requestTax = [],
		} = req.body;

		if (typeof orderProducts === 'string') {
			try {
				orderProducts = JSON.parse(orderProducts);
			} catch (err) {
				console.error('Products parse error:', err);
				orderProducts = [];
			}
		}


		let purchaseOrderData = null;

		if (req.file) {
			purchaseOrderData = {
				public_id: req.file.filename,
				url: `/uploads/${req.file.filename}`,
			};
		}

		if (!quoteId) {
			return res.status(400).json({
				success: false,
				message: 'Quote ID is required',
			});
		}

		const quote = await Quote.findById(quoteId);

		if (!quote) {
			return res.status(404).json({
				success: false,
				message: 'Quote not found',
			});
		}

		if (quote.quoteStage !== 'Confirmed') {
			return res.status(400).json({
				success: false,
				message: 'Order can only be created from a Confirmed quote',
			});
		}



		if (!orderProducts.length) {
			return res.status(400).json({
				success: false,
				message: 'At least one product is required',
			});
		}

		let subtotal = 0;



		const preparedProducts = orderProducts.map((item) => {
		  const quantity = Math.max(1, Number(item.quantity) || 1);
		  const listPrice = Math.max(0, Number(item.listPrice) || 0);

		  const amount = quantity * listPrice;

		  /* ================= PRODUCT TAX ================= */
		  

		  const productTaxes = Array.isArray(item.Tax)
		    ? item.Tax
		    : Array.isArray(item.tax)
		    ? item.tax
		    : [];

		  let productTaxAmount = 0;

		  if (productTaxes.length > 0) {
		    productTaxes.forEach((t) => {
		      const percent = Math.max(0, Number(t.percent) || 0);
		      productTaxAmount += (amount * percent) / 100;
		    });
		  }

		  const total = amount + productTaxAmount;

		  subtotal += total;

		  return {
		    productName: item.productName,
		    description: item.description || '',
		    quantity,
		    listPrice,
		    amount,
		    Tax: productTaxes,
		    taxAmount: productTaxAmount,
		    total,
		  };
		});

		/*
		==============================
		TAX NORMALIZATION
		==============================
		*/

		let normalizedTax = [];

		if (typeof requestTax === 'string') {
			try {
				normalizedTax = JSON.parse(requestTax);
			} catch (err) {
				console.error('Tax JSON parse error:', err);
				normalizedTax = [];
			}
		} else if (Array.isArray(requestTax)) {
			normalizedTax = requestTax;
		}

		/*
		==============================
		ORDER TAX CALCULATION
		==============================
		*/

		let totalTaxAmount = 0;

		const validatedTax = normalizedTax.map((t) => {
			const percent = Math.max(0, Number(t.percent) || 0);

			const taxAmount = (subtotal * percent) / 100;

			totalTaxAmount += taxAmount;

			return {
				tax: t.tax,
				percent,
			};
		});

		const grandTotal = subtotal + totalTaxAmount;

		const seq = await getNextSequence('order');
		const orderNumber = `TIPL-${String(seq).padStart(5, '0')}`;

		console.log(preparedProducts);

		const order = await Order.create({
			finalQuote: quote._id,
			orderNumber,

			products: preparedProducts,

			/* ✅ FIXED */
			otherTax: validatedTax,
			otherTaxAmount: totalTaxAmount,

			currency: quote.currency || 'PKR',

			purchaseOrder: purchaseOrderData,

			subtotal,

			grandTotal,

			confirmedDate: new Date(),

			isSOApproved: false,

			createdBy: req.user?.id,
		});

		return res.status(201).json({
			success: true,
			message: 'Sales Order created successfully',
			data: order,
		});
	} catch (error) {
		console.error('Create Order Error:', error);

		return res.status(500).json({
			success: false,
			message: 'Failed to create order',
			error: error.message,
		});
	}
};

const deleteOrder = async (req, res) => {
	try {
		const { orderId } = req.params;

		if (!orderId) {
			return res.status(400).json({
				success: false,
				message: 'Order ID is required',
			});
		}

		/*
		==============================
		FIND ORDER
		==============================
		*/

		const order = await Order.findById(orderId);

		if (!order || !order.isActive) {
			return res.status(404).json({
				success: false,
				message: 'Order not found',
			});
		}

		if (order.isSOApproved) {
			return res.status(400).json({
				success: false,
				message: 'Approved orders cannot be deleted',
			});
		}

		if (order.status !== 'Pending') {
			return res.status(400).json({
				success: false,
				message: 'Only Pending orders can be deleted',
			});
		}

		/*
		==============================
		SOFT DELETE
		==============================
		*/

		order.isActive = false;

		await order.save();

		/*
		==============================
		RESPONSE
		==============================
		*/

		return res.status(200).json({
			success: true,
			message: 'Order deleted successfully',
		});
	} catch (error) {
		console.error('Delete Order Error:', error);

		return res.status(500).json({
			success: false,
			message: 'Failed to delete order',
			error: error.message,
		});
	}
};

const getMyOrders = async (req, res) => {
	try {
		const { page = 1, limit = 10, search = '', isSOApproved } = req.query;

		/*
		==============================
		SAFE PAGINATION
		==============================
		*/

		const safePage = Math.max(1, Number(page));
		const safeLimit = Math.min(50, Math.max(1, Number(limit)));

		const skip = (safePage - 1) * safeLimit;

		/*
		==============================
		FILTER
		==============================
		*/

		const filter = {
			createdBy: req.user.id,
			isActive: true,
		};

		if (typeof isSOApproved !== 'undefined') {
			filter.isSOApproved = isSOApproved === 'true';
		}

		/*
		==============================
		SEARCH
		==============================
		*/

		if (search) {
			filter.$or = [
				{
					orderNumber: {
						$regex: search,
						$options: 'i',
					},
				},
			];
		}

		/*
		==============================
		QUERY
		==============================
		*/

		const [orders, total] = await Promise.all([
			Order.find(filter)
				.populate({
					path: 'finalQuote',
					select: 'subject quoteNumber quoteStage currency finalTotal',
					populate: [
						{
							path: 'deal',
							select: 'dealName stage',
						},
						{
							path: 'account',
							select: 'accountName',
						},
						{
							path: 'contact',
							select: 'firstName lastName',
						},
					],
				})
				.sort({
					createdAt: -1,
				})
				.skip(skip)
				.limit(safeLimit)
				.lean(),

			Order.countDocuments(filter),
		]);

		/*
		==============================
		RESPONSE
		==============================
		*/

		return res.json({
			success: true,

			data: orders,

			pagination: {
				total,
				page: safePage,
				limit: safeLimit,
				pages: Math.ceil(total / safeLimit),
			},
		});
	} catch (error) {
		console.error('Get Order Error:', error);

		return res.status(500).json({
			success: false,
			message: 'Failed to fetch orders',
		});
	}
};

// ----------------------------------------------------------------------------------

const getAllOrders = async (req, res) => {
	try {
		const { page = 1, limit = 10, search = '', isSOApproved } = req.query;

		/*
		==============================
		SAFE PAGINATION
		==============================
		*/

		const safePage = Math.max(1, Number(page));
		const safeLimit = Math.min(50, Math.max(1, Number(limit)));

		const skip = (safePage - 1) * safeLimit;

		/*
		==============================
		FILTER
		==============================
		*/

		const filter = {
			isActive: true,
		};

		if (typeof isSOApproved !== 'undefined') {
			filter.isSOApproved = isSOApproved === 'true';
		}

		/*
		==============================
		SEARCH
		==============================
		*/

		if (search) {
			filter.$or = [
				{
					orderNumber: {
						$regex: search,
						$options: 'i',
					},
				},
			];
		}

		/*
		==============================
		QUERY
		==============================
		*/

		const [orders, total] = await Promise.all([
			Order.find(filter)
				.populate({
					path: 'finalQuote',
					select: 'subject quoteStage currency finalTotal',
					populate: [
						{
							path: 'deal',
							select: 'dealName stage',
						},
						{
							path: 'account',
							select: 'accountName',
						},
						{
							path: 'contact',
							select: 'firstName lastName',
						},
					],
				})
				.populate('createdBy')
				.sort({
					createdAt: -1,
				})
				.skip(skip)
				.limit(safeLimit)
				.lean(),

			Order.countDocuments(filter),
		]);

		/*
		==============================
		RESPONSE
		==============================
		*/

		return res.json({
			success: true,

			data: orders,

			pagination: {
				total,
				page: safePage,
				limit: safeLimit,
				pages: Math.ceil(total / safeLimit),
			},
		});
	} catch (error) {
		console.error('Get Order Error:', error);

		return res.status(500).json({
			success: false,
			message: 'Failed to fetch orders',
		});
	}
};

const soApproval = async (req, res) => {
	try {
		const { orderId } = req.params;
		const { status } = req.body;

		const order = await Order.findById(orderId).populate('finalQuote');

		if (!order) {
			return res.status(404).json({
				msg: 'Order not found',
			});
		}

		if (order.isSOApproved) {
			return res.status(400).json({
				msg: 'Order already processed',
			});
		}

		order.isSOApproved = true;
		order.status = status;

		await order.save();

		const deal = await Deals.findById(order.finalQuote.deal);

		if (deal) {
			if (status === 'Accepted') {
				deal.amount = order.grandTotal;

				deal.currency = order.currency;

				deal.probability = 100;

				deal.closingDate = new Date();

				deal.stage = 'Closed Won';
			} else {
				deal.stage = 'Closed Lost';
			}

			await deal.save();
		}

		const owner = await User.findById(order.createdBy);

		if (owner && status === 'Accepted') {
			let amountToAdd = order.subtotal || 0;

			if (order.currency === 'USD') {
				const totalInPKR = await convertCurrency(
					amountToAdd,
					'USD',
					'PKR'
				);

				amountToAdd = totalInPKR;
			}

			owner.totalSell = (owner.totalSell || 0) + amountToAdd;

			await owner.save();
		}

		return res.status(200).json({
			success: true,
			message: `Order ${status}`,
			data: order,
		});
	} catch (error) {
		console.error('SO Approval Error:', error);

		return res.status(500).json({
			msg: 'Internal Server error',
		});
	}
};

module.exports = {
	createOrderFromConfirmedQuote,
	getMyOrders,
	deleteOrder,
	getAllOrders,
	soApproval,
};
