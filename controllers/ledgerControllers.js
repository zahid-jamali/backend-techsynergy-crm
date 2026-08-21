const mongoose = require('mongoose');
const ChartOfAccount = require('../models/ChartOfAccount');
const JournalEntry = require('../models/JournalEntry');
const JournalLine = require('../models/JournalLine');
const JournalPostingFailure = require('../models/JournalPostingFailure');
const Payment = require('../models/Payment');
const VendorBill = require('../models/VendorBill');
const PartyBalance = require('../models/PartyBalance');
const Invoice = require('../models/Invoice');
const Account = require('../models/Account');
const Vendor = require('../models/Vendors');
const POToVendor = require('../models/POToVendor');
const getNextSequence = require('../lib/getNextSequence');
const { parseListQuery, sendPage, paginate } = require('../lib/listQuery');
const {
	ensureChartOfAccounts,
	findPostedJournal,
	persistJournal,
	postVendorBill,
	reverseVendorBill,
	postPayment,
	reversePayment,
	retrySource,
	recordFailure,
	fxRate,
	round2,
} = require('../lib/ledger/postingService');
const { getAccountByCode } = require('../lib/ledger/seedChartOfAccounts');

const CASH_CODES = ['1100', '1110', '1120'];

const listChart = async (req, res) => {
	try {
		await ensureChartOfAccounts(req.user.id);
		const data = await ChartOfAccount.find({ isActive: true }).sort({ code: 1 });
		return res.json({ success: true, data });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ success: false, msg: 'Failed to load chart of accounts' });
	}
};

const seedChart = async (req, res) => {
	try {
		await ensureChartOfAccounts(req.user.id);
		const data = await ChartOfAccount.find({ isActive: true }).sort({ code: 1 });
		return res.json({ success: true, msg: 'Chart of accounts is ready', data });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ success: false, msg: 'Failed to seed chart of accounts' });
	}
};

const partyLedger = async (req, res, partyType) => {
	try {
		const { id } = req.params;
		if (!mongoose.Types.ObjectId.isValid(id)) {
			return res.status(400).json({ success: false, msg: 'Invalid party' });
		}
		const currency = req.query.currency === 'USD' ? 'USD' : 'PKR';
		const filter = {
			partyType,
			partyId: id,
			status: 'posted',
			currency,
		};
		if (req.query.from || req.query.to) {
			filter.date = {};
			if (req.query.from) filter.date.$gte = new Date(req.query.from);
			if (req.query.to) filter.date.$lte = new Date(req.query.to);
		}
		const lines = await JournalLine.find(filter)
			.sort({ date: 1, _id: 1 })
			.populate('ledgerAccount', 'code name');
		let running = 0;
		const data = lines.map((line) => {
			running = round2(
				partyType === 'customer'
					? running + line.debit - line.credit
					: running + line.credit - line.debit
			);
			return { ...line.toObject(), runningBalance: running };
		});
		const snapshot = await PartyBalance.findOne({ partyType, partyId: id, currency });
		const party =
			partyType === 'customer'
				? await Account.findById(id).select('accountName')
				: await Vendor.findById(id).select('name code');
		return res.json({
			success: true,
			data,
			party,
			totals: snapshot || {
				debitTotal: data.reduce((s, l) => s + l.debit, 0),
				creditTotal: data.reduce((s, l) => s + l.credit, 0),
				balance: running,
				currency,
			},
		});
	} catch (error) {
		console.error(error);
		return res.status(500).json({ success: false, msg: 'Failed to load ledger' });
	}
};

const listJournals = async (req, res) => {
	try {
		const { page, limit } = parseListQuery(req);
		const filter = {};
		if (req.query.status) filter.status = req.query.status;
		if (req.query.sourceType) filter.sourceType = req.query.sourceType;
		const result = await paginate(JournalEntry, {
			filter,
			page,
			limit,
			populate: [
				{ path: 'postedBy', select: 'name' },
				{ path: 'createdBy', select: 'name' },
			],
		});
		return sendPage(res, result.data, result);
	} catch (error) {
		console.error(error);
		return res.status(500).json({ success: false, msg: 'Failed to load journals' });
	}
};

const getJournal = async (req, res) => {
	try {
		const entry = await JournalEntry.findById(req.params.id)
			.populate('postedBy', 'name')
			.populate('createdBy', 'name');
		if (!entry) return res.status(404).json({ success: false, msg: 'Journal not found' });
		const lines = await JournalLine.find({ journalEntry: entry._id })
			.sort({ lineNo: 1 })
			.populate('ledgerAccount', 'code name');
		return res.json({ success: true, data: { entry, lines } });
	} catch (error) {
		return res.status(500).json({ success: false, msg: 'Failed to load journal' });
	}
};

const createManualJournal = async (req, res) => {
	try {
		await ensureChartOfAccounts(req.user.id);
		const { date, currency = 'PKR', fxRateToPKR, narration, lines = [], sourceType = 'manual' } = req.body;
		if (!['manual', 'opening'].includes(sourceType)) {
			return res.status(400).json({ success: false, msg: 'Only manual or opening journals can be created here' });
		}
		if (!narration || !Array.isArray(lines) || lines.length < 2) {
			return res.status(400).json({ success: false, msg: 'Narration and at least two lines are required' });
		}
		const resolved = [];
		for (const line of lines) {
			const account = line.ledgerAccountCode
				? await getAccountByCode(line.ledgerAccountCode)
				: await ChartOfAccount.findById(line.ledgerAccount);
			if (!account) {
				return res.status(400).json({ success: false, msg: 'Invalid ledger account on a line' });
			}
			resolved.push({
				ledgerAccount: account._id,
				partyType: line.partyType || 'none',
				partyId: line.partyId,
				debit: line.debit,
				credit: line.credit,
				narration: line.narration,
			});
		}
		const sourceId = new mongoose.Types.ObjectId();
		const entry = await persistJournal({
			sourceType,
			sourceId,
			date: date ? new Date(date) : new Date(),
			currency,
			fxRateToPKR: fxRate(currency, fxRateToPKR),
			narration,
			lines: resolved,
			userId: req.user.id,
		});
		return res.status(201).json({ success: true, data: entry });
	} catch (error) {
		console.error(error);
		return res.status(400).json({ success: false, msg: error.message || 'Failed to post journal' });
	}
};

const listPayments = async (req, res) => {
	try {
		const { page, limit } = parseListQuery(req);
		const filter = {};
		if (req.query.status) filter.status = req.query.status;
		if (req.query.direction) filter.direction = req.query.direction;
		const result = await paginate(Payment, {
			filter,
			page,
			limit,
			populate: [
				{ path: 'createdBy', select: 'name' },
				{ path: 'postedBy', select: 'name' },
			],
		});
		return sendPage(res, result.data, result);
	} catch (error) {
		return res.status(500).json({ success: false, msg: 'Failed to load payments' });
	}
};

const createPayment = async (req, res) => {
	try {
		const {
			direction,
			partyId,
			method = 'bank',
			cashAccountCode = '1110',
			date,
			amount,
			currency = 'PKR',
			fxRateToPKR,
			bankReference,
			chequeNumber,
			notes,
			allocations = [],
			post = false,
		} = req.body;
		if (!['inbound', 'outbound'].includes(direction) || !partyId || !amount) {
			return res.status(400).json({ success: false, msg: 'direction, partyId and amount are required' });
		}
		if (!CASH_CODES.includes(cashAccountCode)) {
			return res.status(400).json({ success: false, msg: 'Invalid cash/bank account' });
		}
		if (method === 'cheque' && !chequeNumber) {
			return res.status(400).json({ success: false, msg: 'Cheque number is required' });
		}
		const partyType = direction === 'inbound' ? 'customer' : 'vendor';
		const allocSum = round2(
			(allocations || []).reduce((s, a) => s + Number(a.amount || 0), 0)
		);
		const value = round2(amount);
		if (allocSum > value) {
			return res.status(400).json({ success: false, msg: 'Allocations exceed payment amount' });
		}
		const prefix = direction === 'inbound' ? 'receipt' : 'vendor_payment';
		const numberPrefix = direction === 'inbound' ? 'RCP' : 'PAY';
		const seq = await getNextSequence(prefix);
		const payment = await Payment.create({
			paymentNumber: `${numberPrefix}-${String(seq).padStart(5, '0')}`,
			direction,
			partyType,
			partyId,
			method,
			cashAccountCode,
			date: date ? new Date(date) : new Date(),
			amount: value,
			currency,
			fxRateToPKR: fxRate(currency, fxRateToPKR),
			bankReference,
			chequeNumber,
			notes,
			allocations,
			unallocatedAmount: round2(value - allocSum),
			status: 'draft',
			createdBy: req.user.id,
		});
		if (post) {
			payment.status = 'posted';
			payment.postedAt = new Date();
			payment.postedBy = req.user.id;
			await payment.save();
			try {
				await postPayment(payment._id, req.user.id);
			} catch (error) {
				await recordFailure({
					sourceType: 'payment',
					sourceId: payment._id,
					action: 'payment_post',
					error,
					userId: req.user.id,
				});
			}
		}
		const data = await Payment.findById(payment._id);
		return res.status(201).json({ success: true, data });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ success: false, msg: error.message || 'Failed to create payment' });
	}
};

const postPaymentHandler = async (req, res) => {
	try {
		const payment = await Payment.findById(req.params.id);
		if (!payment) return res.status(404).json({ success: false, msg: 'Payment not found' });
		if (payment.status === 'posted') {
			const existing = await findPostedJournal('payment', payment._id);
			return res.json({ success: true, msg: 'Payment already posted', data: payment, journal: existing });
		}
		if (payment.status !== 'draft') {
			return res.status(400).json({ success: false, msg: 'Only draft payments can be posted' });
		}
		payment.status = 'posted';
		payment.postedAt = new Date();
		payment.postedBy = req.user.id;
		await payment.save();
		try {
			await postPayment(payment._id, req.user.id);
		} catch (error) {
			await recordFailure({
				sourceType: 'payment',
				sourceId: payment._id,
				action: 'payment_post',
				error,
				userId: req.user.id,
			});
		}
		const data = await Payment.findById(payment._id);
		return res.json({ success: true, msg: 'Payment posted', data });
	} catch (error) {
		return res.status(500).json({ success: false, msg: 'Failed to post payment' });
	}
};

const voidPaymentHandler = async (req, res) => {
	try {
		const payment = await Payment.findById(req.params.id);
		if (!payment) return res.status(404).json({ success: false, msg: 'Payment not found' });
		if (payment.status === 'void') {
			return res.json({ success: true, msg: 'Payment already void', data: payment });
		}
		const wasPosted = payment.status === 'posted';
		payment.status = 'void';
		payment.voidedAt = new Date();
		payment.voidedBy = req.user.id;
		await payment.save();
		if (wasPosted) {
			try {
				await reversePayment(payment._id, req.user.id);
			} catch (error) {
				await recordFailure({
					sourceType: 'payment',
					sourceId: payment._id,
					action: 'payment_void',
					error,
					userId: req.user.id,
				});
			}
		}
		return res.json({ success: true, msg: 'Payment voided', data: payment });
	} catch (error) {
		return res.status(500).json({ success: false, msg: 'Failed to void payment' });
	}
};

const listVendorBills = async (req, res) => {
	try {
		const { page, limit } = parseListQuery(req);
		const filter = { isActive: true };
		if (req.query.status) filter.status = req.query.status;
		if (req.query.vendor) filter.vendor = req.query.vendor;
		const result = await paginate(VendorBill, {
			filter,
			page,
			limit,
			populate: [
				{ path: 'vendor', select: 'name code' },
				{ path: 'poToVendor', select: 'poToNumber subject' },
				{ path: 'createdBy', select: 'name' },
			],
		});
		return sendPage(res, result.data, result);
	} catch (error) {
		return res.status(500).json({ success: false, msg: 'Failed to load vendor bills' });
	}
};

const createVendorBill = async (req, res) => {
	try {
		const {
			vendor,
			poToVendor,
			order,
			quote,
			vendorBillRef,
			billDate,
			dueDate,
			currency = 'PKR',
			fxRateToPKR,
			lines = [],
			description,
			post = false,
		} = req.body;
		if (!vendor) return res.status(400).json({ success: false, msg: 'Vendor is required' });
		let billLines = Array.isArray(lines) ? lines : [];
		if (poToVendor && billLines.length === 0) {
			const po = await POToVendor.findById(poToVendor);
			if (!po) return res.status(404).json({ success: false, msg: 'Purchase order not found' });
			billLines = (po.products || []).map((p) => ({
				productName: p.productName,
				quantity: p.quantity,
				listPrice: p.listPrice,
				amount: p.amount,
				total: p.total,
			}));
		}
		if (!billLines.length) {
			return res.status(400).json({ success: false, msg: 'At least one line is required' });
		}
		const normalized = billLines.map((p) => {
			const quantity = Number(p.quantity) || 1;
			const listPrice = Number(p.listPrice) || 0;
			const amount = round2(quantity * listPrice);
			return {
				productName: p.productName,
				quantity,
				listPrice,
				amount,
				total: round2(Number(p.total) || amount),
			};
		});
		const subtotal = round2(normalized.reduce((s, l) => s + l.amount, 0));
		const grandTotal = round2(normalized.reduce((s, l) => s + l.total, 0));
		const seq = await getNextSequence('vendor_bill');
		const bill = await VendorBill.create({
			billNumber: `BILL-${String(seq).padStart(5, '0')}`,
			vendor,
			poToVendor,
			order,
			quote,
			vendorBillRef,
			billDate: billDate ? new Date(billDate) : new Date(),
			dueDate: dueDate ? new Date(dueDate) : undefined,
			currency,
			fxRateToPKR: fxRate(currency, fxRateToPKR),
			lines: normalized,
			subtotal,
			grandTotal,
			description,
			status: 'draft',
			createdBy: req.user.id,
		});
		if (post) {
			bill.status = 'posted';
			bill.postedAt = new Date();
			bill.postedBy = req.user.id;
			await bill.save();
			try {
				await postVendorBill(bill._id, req.user.id);
			} catch (error) {
				await recordFailure({
					sourceType: 'vendor_bill',
					sourceId: bill._id,
					action: 'vendor_bill_post',
					error,
					userId: req.user.id,
				});
			}
		}
		const data = await VendorBill.findById(bill._id).populate('vendor', 'name code');
		return res.status(201).json({ success: true, data });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ success: false, msg: error.message || 'Failed to create vendor bill' });
	}
};

const postVendorBillHandler = async (req, res) => {
	try {
		const bill = await VendorBill.findById(req.params.id);
		if (!bill || !bill.isActive) return res.status(404).json({ success: false, msg: 'Vendor bill not found' });
		if (bill.status === 'posted') {
			return res.json({ success: true, msg: 'Vendor bill already posted', data: bill });
		}
		if (bill.status !== 'draft') {
			return res.status(400).json({ success: false, msg: 'Only draft bills can be posted' });
		}
		bill.status = 'posted';
		bill.postedAt = new Date();
		bill.postedBy = req.user.id;
		await bill.save();
		try {
			await postVendorBill(bill._id, req.user.id);
		} catch (error) {
			await recordFailure({
				sourceType: 'vendor_bill',
				sourceId: bill._id,
				action: 'vendor_bill_post',
				error,
				userId: req.user.id,
			});
		}
		const data = await VendorBill.findById(bill._id).populate('vendor', 'name code');
		return res.json({ success: true, msg: 'Vendor bill posted', data });
	} catch (error) {
		return res.status(500).json({ success: false, msg: 'Failed to post vendor bill' });
	}
};

const cancelVendorBillHandler = async (req, res) => {
	try {
		const bill = await VendorBill.findById(req.params.id);
		if (!bill || !bill.isActive) return res.status(404).json({ success: false, msg: 'Vendor bill not found' });
		if (bill.status === 'cancelled') {
			return res.json({ success: true, msg: 'Vendor bill already cancelled', data: bill });
		}
		const allocated = await Payment.findOne({
			status: 'posted',
			'allocations.documentType': 'vendor_bill',
			'allocations.documentId': bill._id,
		});
		if (allocated) {
			return res.status(400).json({
				success: false,
				msg: 'Cannot cancel a vendor bill with posted payment allocations',
			});
		}
		const wasPosted = bill.status === 'posted';
		bill.status = 'cancelled';
		await bill.save();
		if (wasPosted) {
			try {
				await reverseVendorBill(bill._id, req.user.id);
			} catch (error) {
				await recordFailure({
					sourceType: 'vendor_bill',
					sourceId: bill._id,
					action: 'vendor_bill_cancel',
					error,
					userId: req.user.id,
				});
			}
		}
		return res.json({ success: true, msg: 'Vendor bill cancelled', data: bill });
	} catch (error) {
		return res.status(500).json({ success: false, msg: 'Failed to cancel vendor bill' });
	}
};

const listFailedPostings = async (req, res) => {
	try {
		const { page, limit } = parseListQuery(req);
		const filter = {};
		if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
		else if (!req.query.status) filter.status = 'open';
		const result = await paginate(JournalPostingFailure, {
			filter,
			page,
			limit,
			sort: { updatedAt: -1 },
			populate: [
				{ path: 'createdBy', select: 'name' },
				{ path: 'resolvedBy', select: 'name' },
				{ path: 'journalEntry', select: 'entryNumber status' },
			],
		});
		return sendPage(res, result.data, result);
	} catch (error) {
		return res.status(500).json({ success: false, msg: 'Failed to load posting failures' });
	}
};

const listUnpostedInvoices = async (req, res) => {
	try {
		const issued = await Invoice.find({ isActive: true, status: 'Issued' })
			.select('invoiceNumber grandTotal currency issuedAt order status')
			.populate({
				path: 'order',
				select: 'orderNumber finalQuote',
				populate: {
					path: 'finalQuote',
					select: 'account',
					populate: { path: 'account', select: 'accountName' },
				},
			})
			.sort({ issuedAt: -1 })
			.limit(500)
			.lean();
		const ids = issued.map((inv) => inv._id);
		const posted = await JournalEntry.find({
			sourceType: 'invoice',
			sourceId: { $in: ids },
			status: 'posted',
		})
			.select('sourceId entryNumber')
			.lean();
		const postedMap = new Map(posted.map((row) => [String(row.sourceId), row]));
		const failures = await JournalPostingFailure.find({
			sourceType: 'invoice',
			sourceId: { $in: ids },
		})
			.select('sourceId status lastError retryCount lastAttemptAt')
			.lean();
		const failureMap = new Map(failures.map((row) => [String(row.sourceId), row]));
		const data = issued
			.filter((inv) => !postedMap.has(String(inv._id)))
			.map((inv) => ({
				...inv,
				postingFailure: failureMap.get(String(inv._id)) || null,
			}));
		return res.json({
			success: true,
			data,
			totals: {
				issuedScanned: issued.length,
				missingJournals: data.length,
			},
		});
	} catch (error) {
		console.error(error);
		return res.status(500).json({ success: false, msg: 'Failed to load unposted invoices' });
	}
};

const retryPosting = async (req, res) => {
	try {
		const { sourceType, sourceId } = req.body || {};
		if (!sourceType || !sourceId) {
			return res.status(400).json({ success: false, msg: 'sourceType and sourceId are required' });
		}
		const journal = await retrySource({
			sourceType,
			sourceId,
			userId: req.user.id,
		});
		return res.json({
			success: true,
			msg: journal ? 'Posting retried' : 'Nothing to post',
			data: journal,
		});
	} catch (error) {
		console.error(error);
		if (req.body?.sourceType && req.body?.sourceId) {
			await recordFailure({
				sourceType: req.body.sourceType,
				sourceId: req.body.sourceId,
				action: req.body.action || 'issue',
				error,
				userId: req.user.id,
			});
		}
		return res.status(400).json({ success: false, msg: error.message || 'Retry failed' });
	}
};

module.exports = {
	listChart,
	seedChart,
	partyLedger,
	listJournals,
	getJournal,
	createManualJournal,
	listPayments,
	createPayment,
	postPaymentHandler,
	voidPaymentHandler,
	listVendorBills,
	createVendorBill,
	postVendorBillHandler,
	cancelVendorBillHandler,
	listFailedPostings,
	listUnpostedInvoices,
	retryPosting,
};
