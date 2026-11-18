const Invoice = require('../models/Invoice');
const Delivery = require('../models/Delivery');
const Order = require('../models/Order');
const Account = require('../models/Account');
const FbrSubmission = require('../models/FbrSubmission');
const getNextSequence = require('../lib/getNextSequence');
const ExcelJS = require('exceljs');
const QRCode = require('qrcode');
const { sendPdf } = require('../lib/pdf/renderPdf');
const fbrConfig = require('../lib/fbr/config');
const fbrClient = require('../lib/fbr/client');
const {
	draftFromOrder,
	recompute,
	applyPreset,
	toDoc,
	transmit,
	scenarioDoc,
} = require('../lib/fbr/invoiceService');
const { SALE_TYPES, SCENARIOS, PROVINCES } = require('../lib/fbr/scenarios');
const {
	safePostInvoiceIssued,
	safeReverseInvoiceJournal,
} = require('../lib/ledger/postingService');

const populateInvoice = (query) =>
	query
		.populate({
			path: 'order',
			select: 'orderNumber currency grandTotal subtotal confirmedDate finalQuote purchaseOrder',
			populate: {
				path: 'finalQuote',
				select: 'subject currency',
				populate: [
					{ path: 'deal', select: 'dealName' },
					{ path: 'account', select: 'accountName' },
					{ path: 'contact', select: 'firstName lastName email phone' },
				],
			},
		})
		.populate({
			path: 'delivery',
			select: 'deliveryNumber status deliveryNote supportingDocuments forwardedAt deliveredAt',
		})
		.populate('createdBy', 'name email')
		.populate('issuedBy', 'name email')
		.populate('fbr.submittedBy', 'name email');

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
	} else if (period === 'yearly') {
		start.setMonth(0, 1);
		start.setHours(0, 0, 0, 0);
	} else {
		start.setDate(1);
		start.setHours(0, 0, 0, 0);
	}

	return { start, end };
};

const PERIODS = ['weekly', 'monthly', 'quarterly', 'yearly'];
const pickPeriod = (p) => (PERIODS.includes(p) ? p : 'monthly');

const addDays = (d, n) => {
	const x = new Date(d);
	x.setDate(x.getDate() + n);
	return x;
};

const termsToDays = (terms = '') => {
	const m = String(terms).match(/(\d+)/);
	return m ? Number(m[1]) : 0;
};

/* ------------------------------------------------------------------ */
/* Invoices                                                            */
/* ------------------------------------------------------------------ */

const createInvoiceFromDelivery = async (req, res) => {
	try {
		const { deliveryId, customerRefNo, description, termsAndConditions } = req.body;

		if (!deliveryId) {
			return res.status(400).json({ msg: 'Delivery is required' });
		}

		const delivery = await Delivery.findById(deliveryId).populate({
			path: 'order',
			populate: {
				path: 'finalQuote',
				populate: [{ path: 'account' }, { path: 'contact' }],
			},
		});
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
		const year = new Date().getFullYear();
		const invoiceNumber = `INV-${year}-${String(seq).padStart(5, '0')}`;
		const draft = draftFromOrder(order);
		const documentDate = new Date();

		const invoice = new Invoice({
			invoiceNumber,
			order: order._id,
			delivery: delivery._id,
			documentDate,
			paymentTerms: 'Net 30',
			dueDate: addDays(documentDate, 30),
			customerRefNo: customerRefNo || '',
			description: description || `Supply against sell order ${order.orderNumber || ''}`.trim(),
			currency: order.currency || 'PKR',
			termsAndConditions: termsAndConditions || order.invoiceTermsAndConditions || [],
			buyer: draft.buyer,
			tax: draft.tax,
			lines: draft.lines,
			status: 'Draft',
			createdBy: req.user.id,
		});
		recompute(invoice);
		await invoice.save();

		const populated = await populateInvoice(Invoice.findById(invoice._id));
		return res.status(201).json({
			success: true,
			msg: 'Draft invoice created — complete the tax details before issuing',
			data: populated,
		});
	} catch (error) {
		console.error('Create Invoice Error:', error);
		return res.status(500).json({ msg: 'Failed to create invoice' });
	}
};

const getInvoices = async (req, res) => {
	try {
		const { status, fbrStatus, q } = req.query;
		const filter = { isActive: true };
		if (status) filter.status = status;
		if (fbrStatus) filter['fbr.status'] = fbrStatus;
		if (q) {
			const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
			filter.$or = [
				{ invoiceNumber: rx },
				{ 'buyer.businessName': rx },
				{ 'buyer.ntnCnic': rx },
				{ 'fbr.irn': rx },
				{ customerRefNo: rx },
			];
		}

		const invoices = await populateInvoice(Invoice.find(filter).sort({ createdAt: -1 }).limit(500));
		return res.json({ success: true, data: invoices });
	} catch (error) {
		console.error('Get Invoices Error:', error);
		return res.status(500).json({ msg: 'Failed to fetch invoices' });
	}
};

const getInvoiceById = async (req, res) => {
	try {
		const invoice = await populateInvoice(Invoice.findById(req.params.id));
		if (!invoice || !invoice.isActive) {
			return res.status(404).json({ msg: 'Invoice not found' });
		}
		const submissions = await FbrSubmission.find({ invoice: invoice._id })
			.select('-request -response')
			.sort({ createdAt: -1 })
			.limit(20)
			.populate('createdBy', 'name');
		return res.json({ success: true, data: invoice, submissions });
	} catch (error) {
		console.error('Get Invoice Error:', error);
		return res.status(500).json({ msg: 'Failed to fetch invoice' });
	}
};

const EDITABLE_LINE_FIELDS = [
	'productName',
	'description',
	'hsCode',
	'uoM',
	'quantity',
	'unitPrice',
	'discount',
	'fixedNotifiedValue',
	'extraTax',
	'fedPayable',
	'salesTaxWithheldAtSource',
];

const updateInvoice = async (req, res) => {
	try {
		const invoice = await Invoice.findById(req.params.id);
		if (!invoice || !invoice.isActive) {
			return res.status(404).json({ msg: 'Invoice not found' });
		}
		if (invoice.status !== 'Draft') {
			return res.status(400).json({ msg: 'Only draft invoices can be edited' });
		}

		const body = req.body || {};

		['customerRefNo', 'description', 'notes', 'paymentTerms'].forEach((k) => {
			if (body[k] !== undefined) invoice[k] = body[k];
		});
		if (body.documentDate) invoice.documentDate = new Date(body.documentDate);
		if (body.dueDate) invoice.dueDate = new Date(body.dueDate);
		else if (body.paymentTerms !== undefined) {
			invoice.dueDate = addDays(invoice.documentDate, termsToDays(invoice.paymentTerms));
		}
		if (body.exchangeRate !== undefined) invoice.exchangeRate = Number(body.exchangeRate) || 1;
		if (Array.isArray(body.termsAndConditions)) {
			invoice.termsAndConditions = body.termsAndConditions.map((t) => String(t).trim()).filter(Boolean);
		}

		if (body.buyer) {
			const b = body.buyer;
			const cur = invoice.buyer?.toObject ? invoice.buyer.toObject() : invoice.buyer || {};
			invoice.buyer = {
				...cur,
				...['businessName', 'ntnCnic', 'strn', 'registrationType', 'province', 'address', 'contactName', 'phone', 'email']
					.filter((k) => b[k] !== undefined)
					.reduce((o, k) => ({ ...o, [k]: typeof b[k] === 'string' ? b[k].trim() : b[k] }), {}),
			};
		}

		if (body.tax) {
			const t = body.tax;
			const cur = invoice.tax?.toObject ? invoice.tax.toObject() : invoice.tax || {};
			const switching = t.saleTypeKey && t.saleTypeKey !== cur.saleTypeKey;
			const base = switching
				? applyPreset({}, t.saleTypeKey)
				: applyPreset(cur, cur.saleTypeKey);
			invoice.tax = {
				...base,
				...(t.rate !== undefined && !switching ? { rate: t.rate } : {}),
				...(t.sroScheduleNo !== undefined && !switching ? { sroScheduleNo: t.sroScheduleNo } : {}),
				...(t.sroItemSerialNo !== undefined && !switching ? { sroItemSerialNo: t.sroItemSerialNo } : {}),
				furtherTaxPercent:
					t.furtherTaxPercent !== undefined ? Number(t.furtherTaxPercent) || 0 : cur.furtherTaxPercent || 0,
				retailToEndConsumer:
					t.retailToEndConsumer !== undefined ? Boolean(t.retailToEndConsumer) : Boolean(cur.retailToEndConsumer),
			};
		}

		if (Array.isArray(body.lines)) {
			if (!body.lines.length) {
				return res.status(400).json({ msg: 'An invoice needs at least one line item' });
			}
			invoice.lines = body.lines.map((l) =>
				EDITABLE_LINE_FIELDS.reduce((o, k) => {
					if (l[k] === undefined) return o;
					o[k] = ['productName', 'description', 'hsCode', 'uoM'].includes(k)
						? String(l[k]).trim()
						: Math.max(0, Number(l[k]) || 0);
					return o;
				}, {})
			);
			if (invoice.lines.some((l) => !l.productName)) {
				return res.status(400).json({ msg: 'Every line needs a product name' });
			}
		}

		recompute(invoice);
		if (invoice.fbr?.status === 'validated') invoice.fbr.status = 'not_submitted';
		await invoice.save();

		// Remember buyer tax identity on the account for the next invoice.
		if (body.buyer || body.tax) {
			const order = await Order.findById(invoice.order).populate('finalQuote', 'account');
			const accountId = order?.finalQuote?.account;
			if (accountId) {
				await Account.updateOne(
					{ _id: accountId },
					{
						$set: {
							'meta.fbrBuyer': {
								ntnCnic: invoice.buyer.ntnCnic,
								strn: invoice.buyer.strn,
								registrationType: invoice.buyer.registrationType,
								province: invoice.buyer.province,
								address: invoice.buyer.address,
								saleTypeKey: invoice.tax.saleTypeKey,
							},
						},
					}
				).catch((e) => console.error('Remember buyer failed:', e.message));
			}
		}

		const populated = await populateInvoice(Invoice.findById(invoice._id));
		return res.json({ success: true, msg: 'Invoice saved', data: populated });
	} catch (error) {
		console.error('Update Invoice Error:', error);
		return res.status(500).json({ msg: 'Failed to update invoice' });
	}
};

const fbrErrorResponse = (res, out, fallback) =>
	res.status(422).json({
		msg: out.errors?.length ? out.errors[0] : out.result?.error || fallback,
		errors: out.errors || [],
		fbr: out.result,
	});

const validateInvoiceWithFbr = async (req, res) => {
	try {
		const invoice = await Invoice.findById(req.params.id);
		if (!invoice || !invoice.isActive) return res.status(404).json({ msg: 'Invoice not found' });
		if (!fbrConfig.isEnabled()) return res.status(400).json({ msg: 'FBR digital invoicing is disabled' });
		if (invoice.status !== 'Draft') return res.status(400).json({ msg: 'Only drafts are validated' });

		const out = await transmit({
			mode: 'validate',
			doc: toDoc(invoice),
			invoiceId: invoice._id,
			userId: req.user.id,
		});

		invoice.fbr = {
			...(invoice.fbr?.toObject ? invoice.fbr.toObject() : invoice.fbr),
			environment: fbrConfig.env(),
			scenarioId: out.payload.scenarioId,
			lastValidatedAt: new Date(),
			status: out.result.ok ? 'validated' : 'failed',
			lastErrorCode: out.result.ok ? '' : out.result.errorCode || '',
			lastError: out.result.ok ? '' : out.errors?.join('; ') || out.result.error,
		};
		await invoice.save();

		if (!out.result.ok) return fbrErrorResponse(res, out, 'FBR validation failed');
		return res.json({ success: true, msg: 'FBR validation passed — ready to issue', fbr: out.result });
	} catch (error) {
		console.error('FBR Validate Error:', error);
		return res.status(500).json({ msg: 'Failed to validate invoice with FBR' });
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
		if (!invoice.lines?.length || !(invoice.grandTotal > 0)) {
			return res.status(400).json({ msg: 'Add line items before issuing the invoice' });
		}

		recompute(invoice);

		if (fbrConfig.isEnabled()) {
			if (invoice.currency === 'USD' && !(invoice.exchangeRate > 1)) {
				return res.status(400).json({ msg: 'Enter the PKR exchange rate for a USD invoice before reporting to FBR' });
			}
			const out = await transmit({
				mode: 'post',
				doc: toDoc(invoice),
				invoiceId: invoice._id,
				userId: req.user.id,
			});
			const prev = invoice.fbr?.toObject ? invoice.fbr.toObject() : invoice.fbr || {};
			if (!out.result.ok || !out.result.irn) {
				invoice.fbr = {
					...prev,
					environment: fbrConfig.env(),
					scenarioId: out.payload.scenarioId,
					status: 'failed',
					attempts: (prev.attempts || 0) + 1,
					lastErrorCode: out.result.errorCode || '',
					lastError: out.errors?.join('; ') || out.result.error,
				};
				await invoice.save();
				return fbrErrorResponse(res, out, 'FBR rejected the invoice');
			}
			const itemNos = out.result.itemNumbers || [];
			invoice.lines = invoice.lines.map((l, i) => ({
				...(l.toObject ? l.toObject() : l),
				fbrItemInvoiceNo: itemNos[i]?.invoiceNo || '',
			}));
			invoice.fbr = {
				...prev,
				environment: fbrConfig.env(),
				scenarioId: out.payload.scenarioId,
				status: 'submitted',
				irn: out.result.irn,
				dated: out.result.dated,
				submittedAt: new Date(),
				submittedBy: req.user.id,
				attempts: (prev.attempts || 0) + 1,
				lastErrorCode: '',
				lastError: '',
			};
		}

		invoice.status = 'Issued';
		invoice.issuedAt = new Date();
		invoice.issuedBy = req.user.id;
		await invoice.save();

		await Order.findByIdAndUpdate(invoice.order, {
			fulfillmentStatus: 'invoiced',
		});

		try {
			await safePostInvoiceIssued(invoice._id, req.user.id);
		} catch (postError) {
			console.error('Non-blocking invoice journal hook failed:', postError);
		}
		const populated = await populateInvoice(Invoice.findById(invoice._id));
		return res.json({
			success: true,
			msg: invoice.fbr?.irn
				? `Invoice issued and reported to FBR (IRN ${invoice.fbr.irn})`
				: 'Invoice issued',
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
		if (invoice.status === 'Cancelled') {
			return res.status(400).json({ msg: 'Invoice is already cancelled' });
		}
		if (invoice.fbr?.irn && invoice.fbr?.environment === 'production') {
			return res.status(400).json({
				msg: 'This invoice is reported to FBR. FBR does not allow cancellation — issue a debit/credit note instead.',
			});
		}
		const reason = String(req.body?.reason || '').trim();
		if (invoice.status === 'Issued' && !reason) {
			return res.status(400).json({ msg: 'A cancellation reason is required for issued invoices' });
		}
		const wasIssued = invoice.status === 'Issued';
		invoice.status = 'Cancelled';
		invoice.cancelledAt = new Date();
		invoice.cancelledBy = req.user.id;
		invoice.cancelReason = reason;
		await invoice.save();

		await Order.findByIdAndUpdate(invoice.order, {
			fulfillmentStatus: 'forwarded_to_finance',
		});

		try {
			await safeReverseInvoiceJournal(invoice._id, req.user.id, wasIssued);
		} catch (postError) {
			console.error('Non-blocking invoice journal reverse hook failed:', postError);
		}
		return res.json({ success: true, msg: 'Invoice cancelled', data: invoice });
	} catch (error) {
		console.error('Cancel Invoice Error:', error);
		return res.status(500).json({ msg: 'Failed to cancel invoice' });
	}
};

const downloadInvoicePdf = async (req, res) => {
	try {
		const invoice = await Invoice.findById(req.params.id)
			.populate({
				path: 'order',
				select: 'orderNumber confirmedDate finalQuote',
				populate: { path: 'finalQuote', select: 'subject' },
			})
			.populate('delivery', 'deliveryNumber deliveredAt')
			.populate('issuedBy', 'name')
			.lean();
		if (!invoice || !invoice.isActive) {
			return res.status(404).json({ msg: 'Invoice not found' });
		}
		let qrDataUrl = null;
		if (invoice.fbr?.irn) {
			// FBR spec: QR version 2.0 (25x25), printed at 1.0 x 1.0 inch.
			const opts = { errorCorrectionLevel: 'L', margin: 0, width: 300 };
			qrDataUrl = await QRCode.toDataURL(invoice.fbr.irn, { ...opts, version: 2 }).catch(() =>
				QRCode.toDataURL(invoice.fbr.irn, opts)
			);
		}
		return sendPdf(
			res,
			'TaxInvoiceDocument',
			{ invoice, seller: fbrConfig.seller(), qrDataUrl },
			`${invoice.invoiceNumber}.pdf`
		);
	} catch (error) {
		console.error('Invoice PDF Error:', error);
		if (!res.headersSent) return res.status(500).json({ msg: 'Failed to generate invoice PDF' });
	}
};

/* ------------------------------------------------------------------ */
/* Queue, dashboard, reports                                           */
/* ------------------------------------------------------------------ */

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
		}).select('delivery status invoiceNumber fbr.status fbr.irn grandTotal');

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
		const sixMonthsAgo = new Date(start);
		sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);

		const [
			queueAll,
			draftCount,
			issuedCount,
			cancelledCount,
			fbrFailed,
			fbrSubmitted,
			issuedThisMonth,
			recentInvoices,
			trend,
			overdue,
		] = await Promise.all([
			Delivery.find({ isActive: true, status: 'forwarded_to_finance' }).select('_id'),
			Invoice.countDocuments({ isActive: true, status: 'Draft' }),
			Invoice.countDocuments({ isActive: true, status: 'Issued' }),
			Invoice.countDocuments({ isActive: true, status: 'Cancelled' }),
			Invoice.countDocuments({ isActive: true, status: 'Draft', 'fbr.status': 'failed' }),
			Invoice.countDocuments({ isActive: true, 'fbr.status': 'submitted' }),
			Invoice.find({
				isActive: true,
				status: 'Issued',
				issuedAt: { $gte: start, $lte: end },
			}).select('grandTotal totals currency exchangeRate'),
			populateInvoice(Invoice.find({ isActive: true }).sort({ updatedAt: -1 }).limit(8)),
			Invoice.aggregate([
				{ $match: { isActive: true, status: 'Issued', issuedAt: { $gte: sixMonthsAgo } } },
				{
					$group: {
						_id: { y: { $year: '$issuedAt' }, m: { $month: '$issuedAt' } },
						revenue: { $sum: '$grandTotal' },
						salesTax: { $sum: { $ifNull: ['$totals.salesTax', 0] } },
						count: { $sum: 1 },
					},
				},
				{ $sort: { '_id.y': 1, '_id.m': 1 } },
			]),
			Invoice.countDocuments({ isActive: true, status: 'Issued', dueDate: { $lt: new Date() } }),
		]);

		const invoiced = await Invoice.find({
			delivery: { $in: queueAll.map((d) => d._id) },
			isActive: true,
			status: { $ne: 'Cancelled' },
		}).select('_id');

		const toPkr = (inv, v) => (inv.currency === 'USD' ? (v || 0) * (inv.exchangeRate || 1) : v || 0);
		const monthlyRevenue = issuedThisMonth.reduce((s, inv) => s + toPkr(inv, inv.grandTotal), 0);
		const monthlySalesTax = issuedThisMonth.reduce((s, inv) => s + toPkr(inv, inv.totals?.salesTax), 0);

		return res.json({
			success: true,
			data: {
				kpis: {
					queueCount: Math.max(0, queueAll.length - invoiced.length),
					draftCount,
					issuedCount,
					cancelledCount,
					monthlyRevenue,
					monthlySalesTax,
					issuedThisMonth: issuedThisMonth.length,
					fbrFailed,
					fbrSubmitted,
					overdue,
				},
				trend: trend.map((t) => ({
					label: new Date(t._id.y, t._id.m - 1, 1).toLocaleString('en-US', { month: 'short', year: '2-digit' }),
					revenue: t.revenue,
					salesTax: t.salesTax,
					count: t.count,
				})),
				fbr: fbrConfig.publicConfig(),
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

	const sum = (k) => invoices.reduce((s, inv) => s + (inv.totals?.[k] || 0), 0);
	const totalRevenue = invoices.reduce((s, inv) => s + (inv.grandTotal || 0), 0);

	return {
		period,
		start,
		end,
		totals: {
			invoicesIssued: invoices.length,
			totalRevenue,
			valueExclST: sum('valueExclST'),
			salesTax: sum('salesTax'),
			furtherTax: sum('furtherTax'),
			fbrReported: invoices.filter((i) => i.fbr?.irn).length,
			forwarded,
			pendingInvoicing,
		},
		invoices,
	};
};

const getFinanceReport = async (req, res) => {
	try {
		const report = await buildReport(pickPeriod(req.query.period));
		return res.json({ success: true, data: report });
	} catch (error) {
		console.error('Finance Report Error:', error);
		return res.status(500).json({ msg: 'Failed to generate report' });
	}
};

const downloadFinanceReport = async (req, res) => {
	try {
		const period = pickPeriod(req.query.period);
		const report = await buildReport(period);

		res.setHeader(
			'Content-Type',
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
		);
		res.setHeader(
			'Content-Disposition',
			`attachment; filename=sales-tax-register-${period}.xlsx`
		);

		const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
			stream: res,
			useStyles: true,
		});
		const sheet = workbook.addWorksheet('Sales register');
		sheet.columns = [
			{ header: 'Invoice No', key: 'invoiceNumber', width: 18 },
			{ header: 'Invoice Date', key: 'date', width: 14 },
			{ header: 'FBR IRN', key: 'irn', width: 28 },
			{ header: 'Buyer', key: 'buyer', width: 32 },
			{ header: 'Buyer NTN/CNIC', key: 'ntn', width: 18 },
			{ header: 'Registration', key: 'reg', width: 14 },
			{ header: 'Province', key: 'province', width: 16 },
			{ header: 'Sale Type', key: 'saleType', width: 30 },
			{ header: 'Rate', key: 'rate', width: 12 },
			{ header: 'Currency', key: 'currency', width: 10 },
			{ header: 'Value Excl. ST', key: 'value', width: 16 },
			{ header: 'Sales Tax', key: 'st', width: 14 },
			{ header: 'Further Tax', key: 'ft', width: 14 },
			{ header: 'Total', key: 'total', width: 16 },
			{ header: 'Order No', key: 'orderNumber', width: 16 },
			{ header: 'Issued By', key: 'issuedBy', width: 20 },
		];

		const header = sheet.getRow(1);
		header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
		header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B2965' } };
		header.commit();

		report.invoices.forEach((inv) => {
			sheet
				.addRow({
					invoiceNumber: inv.invoiceNumber,
					date: inv.documentDate ? new Date(inv.documentDate).toLocaleDateString('en-GB') : '-',
					irn: inv.fbr?.irn || '-',
					buyer: inv.buyer?.businessName || inv.order?.finalQuote?.account?.accountName || '-',
					ntn: inv.buyer?.ntnCnic || '-',
					reg: inv.buyer?.registrationType || '-',
					province: inv.buyer?.province || '-',
					saleType: inv.tax?.saleType || '-',
					rate: inv.tax?.rate || '-',
					currency: inv.currency,
					value: inv.totals?.valueExclST || inv.subtotal || 0,
					st: inv.totals?.salesTax || 0,
					ft: inv.totals?.furtherTax || 0,
					total: inv.grandTotal || 0,
					orderNumber: inv.order?.orderNumber || '-',
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

/* ------------------------------------------------------------------ */
/* FBR Digital Invoicing                                               */
/* ------------------------------------------------------------------ */

const getFbrConfig = async (req, res) => {
	return res.json({
		success: true,
		data: {
			...fbrConfig.publicConfig(),
			saleTypes: Object.values(SALE_TYPES),
			provinces: PROVINCES,
			uoms: ['Numbers, pieces, units', 'KG', 'Liter', 'Meter', 'Square Metre', 'Dozen', 'Pair', 'Set', 'Ton', 'Gram', 'Carat', 'Bag', 'Packs'],
		},
	});
};

const getFbrScenarios = async (req, res) => {
	try {
		const env = fbrConfig.env();
		const runs = await FbrSubmission.aggregate([
			{ $match: { source: 'scenario_test', environment: env } },
			{ $sort: { createdAt: -1 } },
			{
				$group: {
					_id: { scenarioId: '$scenarioId', mode: '$mode' },
					last: { $first: '$$ROOT' },
					passed: { $max: { $cond: ['$ok', 1, 0] } },
				},
			},
		]);
		const invoicePosts = await FbrSubmission.aggregate([
			{ $match: { source: 'invoice', environment: env, mode: 'post', ok: true } },
			{ $group: { _id: '$scenarioId', count: { $sum: 1 }, lastIrn: { $last: '$irn' } } },
		]);
		const byKey = {};
		runs.forEach((r) => {
			byKey[`${r._id.scenarioId}:${r._id.mode}`] = r;
		});
		const invByScenario = Object.fromEntries(invoicePosts.map((r) => [r._id, r]));

		const data = SCENARIOS.map((s) => {
			const v = byKey[`${s.id}:validate`];
			const p = byKey[`${s.id}:post`];
			const posted = Boolean(p?.passed) || Boolean(invByScenario[s.id]);
			return {
				id: s.id,
				title: s.title,
				saleType: SALE_TYPES[s.saleTypeKey].saleType,
				buyerRegistrationType: s.buyer,
				status: posted ? 'passed' : v?.passed ? 'validated' : p || v ? 'failed' : 'pending',
				lastValidate: v
					? { ok: v.last.ok, at: v.last.createdAt, errorCode: v.last.errorCode, error: v.last.error }
					: null,
				lastPost: p
					? { ok: p.last.ok, at: p.last.createdAt, irn: p.last.irn, errorCode: p.last.errorCode, error: p.last.error }
					: null,
				invoicesPosted: invByScenario[s.id]?.count || 0,
			};
		});
		return res.json({ success: true, environment: env, data });
	} catch (error) {
		console.error('FBR Scenarios Error:', error);
		return res.status(500).json({ msg: 'Failed to load FBR scenarios' });
	}
};

const runFbrScenario = async (req, res) => {
	try {
		if (fbrConfig.env() !== 'sandbox') {
			return res.status(400).json({ msg: 'Scenario tests only run against the FBR sandbox' });
		}
		const s = SCENARIOS.find((x) => x.id === req.params.id);
		if (!s) return res.status(404).json({ msg: 'Unknown scenario' });
		const mode = req.body?.mode === 'post' ? 'post' : 'validate';
		const out = await transmit({
			mode,
			doc: scenarioDoc(s),
			userId: req.user.id,
			source: 'scenario_test',
		});
		const status = out.result.ok ? 200 : 422;
		return res.status(status).json({
			success: out.result.ok,
			msg: out.result.ok
				? mode === 'post'
					? `${s.id} posted to FBR sandbox — IRN ${out.result.irn}`
					: `${s.id} passed FBR validation`
				: out.errors?.[0] || out.result.error || 'FBR rejected the scenario',
			fbr: out.result,
			request: out.payload,
		});
	} catch (error) {
		console.error('FBR Scenario Error:', error);
		return res.status(500).json({ msg: 'Failed to run scenario' });
	}
};

const getFbrSubmissions = async (req, res) => {
	try {
		const filter = {};
		if (req.query.invoice) filter.invoice = req.query.invoice;
		if (req.query.scenarioId) filter.scenarioId = req.query.scenarioId;
		const rows = await FbrSubmission.find(filter)
			.sort({ createdAt: -1 })
			.limit(Math.min(Number(req.query.limit) || 50, 200))
			.populate('invoice', 'invoiceNumber')
			.populate('createdBy', 'name');
		return res.json({ success: true, data: rows });
	} catch (error) {
		return res.status(500).json({ msg: 'Failed to load FBR log' });
	}
};

const getFbrReference = async (req, res) => {
	try {
		const data = await fbrClient.reference(req.params.name, req.query);
		return res.json({ success: true, data });
	} catch (error) {
		return res.status(502).json({ msg: error.message || 'FBR reference lookup failed' });
	}
};

const checkBuyerRegistration = async (req, res) => {
	try {
		const regNo = String(req.query.regNo || '').trim();
		if (!regNo) return res.status(400).json({ msg: 'Registration number is required' });
		const data = await fbrClient.registrationType(regNo);
		return res.json({ success: true, data });
	} catch (error) {
		return res.status(502).json({ msg: error.message || 'FBR registration lookup failed' });
	}
};

module.exports = {
	createInvoiceFromDelivery,
	getInvoices,
	getInvoiceById,
	updateInvoice,
	validateInvoiceWithFbr,
	issueInvoice,
	cancelInvoice,
	downloadInvoicePdf,
	getFinanceQueue,
	getFinanceDashboard,
	getFinanceReport,
	downloadFinanceReport,
	getFbrConfig,
	getFbrScenarios,
	runFbrScenario,
	getFbrSubmissions,
	getFbrReference,
	checkBuyerRegistration,
};
