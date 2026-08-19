const Invoice = require('../models/Invoice');
const Delivery = require('../models/Delivery');
const Order = require('../models/Order');
const getNextSequence = require('../lib/getNextSequence');
const ExcelJS = require('exceljs');

const populateInvoice = (query) =>
	query
		.populate({
			path: 'order',
			populate: {
				path: 'finalQuote',
				select: 'subject currency',
				populate: [
					{ path: 'deal', select: 'dealName' },
					{ path: 'account', select: 'accountName' },
					{ path: 'contact', select: 'firstName lastName' },
				],
			},
		})
		.populate({
			path: 'delivery',
			select: 'deliveryNumber status deliveryNote supportingDocuments forwardedAt',
		})
		.populate('createdBy', 'name email')
		.populate('issuedBy', 'name email');

const getPeriodRange = (period = 'monthly', base = new Date()) => {
	const end = new Date(base);
	end.setHours(23, 59, 59, 999);
	const start = new Date(base);

	if (period === 'weekly') {
		const day = start.getDay();
		const diff = day === 0 ? 6 : day - 1;
		start.setDate(start.getDate() - diff);
		start.setHours(0, 0, 0, 0);
	} else if (period === 'quarterly') {
		const quarter = Math.floor(start.getMonth() / 3);
		start.setMonth(quarter * 3, 1);
		start.setHours(0, 0, 0, 0);
	} else {
		start.setDate(1);
		start.setHours(0, 0, 0, 0);
	}

	return { start, end };
};

const createInvoiceFromDelivery = async (req, res) => {
	try {
		const { deliveryId, customerRefNo, description, termsAndConditions } =
			req.body;

		if (!deliveryId) {
			return res.status(400).json({ msg: 'Delivery is required' });
		}

		const delivery = await Delivery.findById(deliveryId).populate('order');
		if (!delivery || !delivery.isActive) {
			return res.status(404).json({ msg: 'Delivery not found' });
		}
		if (delivery.status !== 'forwarded_to_finance') {
			return res.status(400).json({
				msg: 'Invoice can only be created after operations forwards the delivery',
			});
		}

		const existing = await Invoice.findOne({
			delivery: deliveryId,
			isActive: true,
			status: { $ne: 'Cancelled' },
		});
		if (existing) {
			return res.status(409).json({
				msg: 'An invoice already exists for this delivery',
				data: existing,
			});
		}

		const order = delivery.order;
		const seq = await getNextSequence('invoice');
		const invoiceNumber = `INV-${String(seq).padStart(5, '0')}`;

		const invoice = await Invoice.create({
			invoiceNumber,
			order: order._id,
			delivery: delivery._id,
			customerRefNo,
			description:
				description ||
				`Invoice for ${order.orderNumber || 'sell order'}`,
			subtotal: order.subtotal || 0,
			grandTotal: order.grandTotal || 0,
			currency: order.currency || 'PKR',
			termsAndConditions:
				termsAndConditions || order.invoiceTermsAndConditions || [],
			status: 'Draft',
			createdBy: req.user.id,
		});

		const populated = await populateInvoice(Invoice.findById(invoice._id));
		return res.status(201).json({
			success: true,
			msg: 'Draft invoice created',
			data: populated,
		});
	} catch (error) {
		console.error('Create Invoice Error:', error);
		return res.status(500).json({ msg: 'Failed to create invoice' });
	}
};

const getInvoices = async (req, res) => {
	try {
		const { status } = req.query;
		const filter = { isActive: true };
		if (status) filter.status = status;

		const invoices = await populateInvoice(
			Invoice.find(filter).sort({ createdAt: -1 })
		);
		return res.json({ success: true, data: invoices });
	} catch (error) {
		console.error('Get Invoices Error:', error);
		return res.status(500).json({ msg: 'Failed to fetch invoices' });
	}
};

const issueInvoice = async (req, res) => {
	try {
		const invoice = await Invoice.findById(req.params.id);
		if (!invoice || !invoice.isActive) {
			return res.status(404).json({ msg: 'Invoice not found' });
		}
		if (invoice.status === 'Issued') {
			return res.status(400).json({ msg: 'Invoice already issued' });
		}
		if (invoice.status === 'Cancelled') {
			return res.status(400).json({ msg: 'Cancelled invoices cannot be issued' });
		}

		invoice.status = 'Issued';
		invoice.issuedAt = new Date();
		invoice.issuedBy = req.user.id;
		await invoice.save();

		await Order.findByIdAndUpdate(invoice.order, {
			fulfillmentStatus: 'invoiced',
		});

		const populated = await populateInvoice(Invoice.findById(invoice._id));
		return res.json({
			success: true,
			msg: 'Invoice issued',
			data: populated,
		});
	} catch (error) {
		console.error('Issue Invoice Error:', error);
		return res.status(500).json({ msg: 'Failed to issue invoice' });
	}
};

const cancelInvoice = async (req, res) => {
	try {
		const invoice = await Invoice.findById(req.params.id);
		if (!invoice || !invoice.isActive) {
			return res.status(404).json({ msg: 'Invoice not found' });
		}
		invoice.status = 'Cancelled';
		await invoice.save();

		await Order.findByIdAndUpdate(invoice.order, {
			fulfillmentStatus: 'forwarded_to_finance',
		});

		return res.json({ success: true, msg: 'Invoice cancelled', data: invoice });
	} catch (error) {
		return res.status(500).json({ msg: 'Failed to cancel invoice' });
	}
};

const getFinanceQueue = async (req, res) => {
	try {
		const deliveries = await Delivery.find({
			isActive: true,
			status: 'forwarded_to_finance',
		})
			.sort({ forwardedAt: -1 })
			.populate({
				path: 'order',
				populate: {
					path: 'finalQuote',
					select: 'subject currency',
					populate: [
						{ path: 'deal', select: 'dealName' },
						{ path: 'account', select: 'accountName' },
					],
				},
			})
			.populate('forwardedBy', 'name');

		const deliveryIds = deliveries.map((d) => d._id);
		const invoices = await Invoice.find({
			delivery: { $in: deliveryIds },
			isActive: true,
			status: { $ne: 'Cancelled' },
		}).select('delivery status invoiceNumber');

		const invoiceByDelivery = {};
		invoices.forEach((inv) => {
			invoiceByDelivery[String(inv.delivery)] = inv;
		});

		const data = deliveries.map((d) => ({
			...d.toObject(),
			invoice: invoiceByDelivery[String(d._id)] || null,
		}));

		return res.json({ success: true, data });
	} catch (error) {
		console.error('Finance Queue Error:', error);
		return res.status(500).json({ msg: 'Failed to load finance queue' });
	}
};

const getFinanceDashboard = async (req, res) => {
	try {
		const { start, end } = getPeriodRange('monthly');

		const [
			queueCount,
			draftCount,
			issuedCount,
			cancelledCount,
			issuedThisMonth,
			recentInvoices,
		] = await Promise.all([
			Delivery.countDocuments({
				isActive: true,
				status: 'forwarded_to_finance',
			}),
			Invoice.countDocuments({ isActive: true, status: 'Draft' }),
			Invoice.countDocuments({ isActive: true, status: 'Issued' }),
			Invoice.countDocuments({ isActive: true, status: 'Cancelled' }),
			Invoice.find({
				isActive: true,
				status: 'Issued',
				issuedAt: { $gte: start, $lte: end },
			}),
			populateInvoice(
				Invoice.find({ isActive: true }).sort({ updatedAt: -1 }).limit(8)
			),
		]);

		const monthlyRevenue = issuedThisMonth.reduce(
			(sum, inv) => sum + (inv.grandTotal || 0),
			0
		);

		return res.json({
			success: true,
			data: {
				kpis: {
					queueCount,
					draftCount,
					issuedCount,
					cancelledCount,
					monthlyRevenue,
					issuedThisMonth: issuedThisMonth.length,
				},
				recentInvoices,
			},
		});
	} catch (error) {
		console.error('Finance Dashboard Error:', error);
		return res.status(500).json({ msg: 'Failed to load finance dashboard' });
	}
};

const buildReport = async (period) => {
	const { start, end } = getPeriodRange(period);

	const invoices = await populateInvoice(
		Invoice.find({
			isActive: true,
			status: 'Issued',
			issuedAt: { $gte: start, $lte: end },
		}).sort({ issuedAt: -1 })
	);

	const forwarded = await Delivery.countDocuments({
		isActive: true,
		forwardedAt: { $gte: start, $lte: end },
	});

	const pendingInvoicing = await Delivery.countDocuments({
		isActive: true,
		status: 'forwarded_to_finance',
	});

	const totalRevenue = invoices.reduce(
		(sum, inv) => sum + (inv.grandTotal || 0),
		0
	);

	return {
		period,
		start,
		end,
		totals: {
			invoicesIssued: invoices.length,
			totalRevenue,
			forwarded,
			pendingInvoicing,
		},
		invoices,
	};
};

const getFinanceReport = async (req, res) => {
	try {
		const period = ['weekly', 'monthly', 'quarterly'].includes(req.query.period)
			? req.query.period
			: 'monthly';
		const report = await buildReport(period);
		return res.json({ success: true, data: report });
	} catch (error) {
		console.error('Finance Report Error:', error);
		return res.status(500).json({ msg: 'Failed to generate report' });
	}
};

const downloadFinanceReport = async (req, res) => {
	try {
		const period = ['weekly', 'monthly', 'quarterly'].includes(req.query.period)
			? req.query.period
			: 'monthly';
		const report = await buildReport(period);

		res.setHeader(
			'Content-Type',
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
		);
		res.setHeader(
			'Content-Disposition',
			`attachment; filename=finance-${period}-report.xlsx`
		);

		const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
			stream: res,
			useStyles: true,
		});
		const sheet = workbook.addWorksheet(`${period} report`);
		sheet.columns = [
			{ header: 'Invoice No', key: 'invoiceNumber', width: 16 },
			{ header: 'Order No', key: 'orderNumber', width: 16 },
			{ header: 'Account', key: 'account', width: 28 },
			{ header: 'Deal', key: 'deal', width: 28 },
			{ header: 'Currency', key: 'currency', width: 12 },
			{ header: 'Amount', key: 'amount', width: 16 },
			{ header: 'Issued At', key: 'issuedAt', width: 18 },
			{ header: 'Issued By', key: 'issuedBy', width: 22 },
		];

		sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
		sheet.getRow(1).fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: 'FF021D54' },
		};

		report.invoices.forEach((inv) => {
			sheet
				.addRow({
					invoiceNumber: inv.invoiceNumber,
					orderNumber: inv.order?.orderNumber || '-',
					account: inv.order?.finalQuote?.account?.accountName || '-',
					deal: inv.order?.finalQuote?.deal?.dealName || '-',
					currency: inv.currency,
					amount: inv.grandTotal || 0,
					issuedAt: inv.issuedAt
						? new Date(inv.issuedAt).toLocaleDateString()
						: '-',
					issuedBy: inv.issuedBy?.name || '-',
				})
				.commit();
		});

		await workbook.commit();
	} catch (error) {
		console.error('Finance Excel Error:', error);
		if (!res.headersSent) {
			return res.status(500).json({ msg: 'Failed to download report' });
		}
	}
};

module.exports = {
	createInvoiceFromDelivery,
	getInvoices,
	issueInvoice,
	cancelInvoice,
	getFinanceQueue,
	getFinanceDashboard,
	getFinanceReport,
	downloadFinanceReport,
};
