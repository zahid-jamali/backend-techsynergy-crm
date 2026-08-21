const mongoose = require('mongoose');
const JournalEntry = require('../../models/JournalEntry');
const JournalLine = require('../../models/JournalLine');
const JournalPostingFailure = require('../../models/JournalPostingFailure');
const PartyBalance = require('../../models/PartyBalance');
const Invoice = require('../../models/Invoice');
const VendorBill = require('../../models/VendorBill');
const Payment = require('../../models/Payment');
const getNextSequence = require('../getNextSequence');
const { ensureChartOfAccounts, getAccountByCode } = require('./seedChartOfAccounts');

const DUPLICATE_KEY = 11000;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const fxRate = (currency, rate) => {
	if (currency === 'PKR') return 1;
	const value = Number(rate);
	return value > 0 ? value : 1;
};

const findPostedJournal = (sourceType, sourceId) =>
	JournalEntry.findOne({
		sourceType,
		sourceId,
		status: 'posted',
	});

const errorMessage = (err) =>
	err?.message || err?.msg || String(err || 'Unknown journal posting error');

const recordFailure = async ({
	sourceType,
	sourceId,
	action,
	error,
	userId,
}) => {
	try {
		await JournalPostingFailure.findOneAndUpdate(
			{ sourceType, sourceId },
			{
				$set: {
					action,
					status: 'open',
					lastError: errorMessage(error),
					errorName: error?.name,
					lastAttemptAt: new Date(),
					createdBy: userId,
				},
				$inc: { retryCount: 1 },
			},
			{ upsert: true, new: true, setDefaultsOnInsert: true }
		);
	} catch (writeErr) {
		console.error('Failed to record journal posting failure:', writeErr);
	}
};

const resolveFailure = async (sourceType, sourceId, userId, journalEntry) => {
	await JournalPostingFailure.findOneAndUpdate(
		{ sourceType, sourceId },
		{
			$set: {
				status: 'resolved',
				resolvedAt: new Date(),
				resolvedBy: userId,
				journalEntry: journalEntry?._id,
				lastError: 'Resolved',
				lastAttemptAt: new Date(),
			},
		}
	);
};

const rebuildPartyBalance = async (partyType, partyId, currency) => {
	if (!partyType || partyType === 'none' || !partyId) return;
	const [totals] = await JournalLine.aggregate([
		{
			$match: {
				partyType,
				partyId: new mongoose.Types.ObjectId(String(partyId)),
				currency,
				status: 'posted',
			},
		},
		{
			$group: {
				_id: null,
				debitTotal: { $sum: '$debit' },
				creditTotal: { $sum: '$credit' },
				asOf: { $max: '$date' },
			},
		},
	]);
	const debitTotal = round2(totals?.debitTotal);
	const creditTotal = round2(totals?.creditTotal);
	const balance =
		partyType === 'customer'
			? round2(debitTotal - creditTotal)
			: round2(creditTotal - debitTotal);
	await PartyBalance.findOneAndUpdate(
		{ partyType, partyId, currency },
		{ $set: { debitTotal, creditTotal, balance, asOf: totals?.asOf || new Date() } },
		{ upsert: true }
	);
};

const persistJournal = async ({
	sourceType,
	sourceId,
	date,
	currency,
	fxRateToPKR,
	narration,
	lines,
	userId,
}) => {
	const existing = await findPostedJournal(sourceType, sourceId);
	if (existing) return existing;

	const debitSum = round2(lines.reduce((s, l) => s + Number(l.debit || 0), 0));
	const creditSum = round2(lines.reduce((s, l) => s + Number(l.credit || 0), 0));
	if (lines.length < 2 || debitSum !== creditSum || debitSum <= 0) {
		throw new Error('Journal is not balanced');
	}
	for (const line of lines) {
		const d = Number(line.debit || 0);
		const c = Number(line.credit || 0);
		if ((d > 0 && c > 0) || (d <= 0 && c <= 0)) {
			throw new Error('Each journal line must be debit XOR credit');
		}
		if (line.partyType && line.partyType !== 'none' && !line.partyId) {
			throw new Error('Party is required on party ledger lines');
		}
	}

	const seq = await getNextSequence('journal');
	const entryNumber = `JV-${String(seq).padStart(5, '0')}`;
	const rate = fxRate(currency, fxRateToPKR);
	const postedAt = new Date();

	let entry;
	try {
		entry = await JournalEntry.create({
			entryNumber,
			date,
			currency,
			fxRateToPKR: rate,
			status: 'posted',
			sourceType,
			sourceId,
			narration,
			postedAt,
			postedBy: userId,
			createdBy: userId,
		});
	} catch (err) {
		if (err.code === DUPLICATE_KEY) {
			const posted = await findPostedJournal(sourceType, sourceId);
			if (posted) return posted;
		}
		throw err;
	}

	try {
		await JournalLine.insertMany(
			lines.map((line, index) => {
				const amount = Number(line.debit || line.credit || 0);
				return {
					journalEntry: entry._id,
					lineNo: index + 1,
					ledgerAccount: line.ledgerAccount,
					partyType: line.partyType || 'none',
					partyId: line.partyId || undefined,
					debit: round2(line.debit),
					credit: round2(line.credit),
					amountPKR: round2(amount * rate),
					narration: line.narration || narration,
					date,
					status: 'posted',
					sourceType,
					sourceId,
					entryNumber,
					currency,
					fxRateToPKR: rate,
				};
			})
		);
	} catch (err) {
		await JournalEntry.deleteOne({ _id: entry._id });
		if (err.code === DUPLICATE_KEY) {
			const posted = await findPostedJournal(sourceType, sourceId);
			if (posted) return posted;
		}
		throw err;
	}

	const parties = new Map();
	lines.forEach((line) => {
		if (line.partyType && line.partyType !== 'none' && line.partyId) {
			parties.set(`${line.partyType}:${line.partyId}:${currency}`, {
				partyType: line.partyType,
				partyId: line.partyId,
				currency,
			});
		}
	});
	await Promise.all(
		[...parties.values()].map((p) =>
			rebuildPartyBalance(p.partyType, p.partyId, p.currency)
		)
	);

	return entry;
};

const voidAndReverse = async (entry, userId, reason) => {
	if (!entry || entry.status !== 'posted') return entry;
	const lines = await JournalLine.find({ journalEntry: entry._id }).sort({
		lineNo: 1,
	});
	const reversal = await persistJournal({
		sourceType: 'reversal',
		sourceId: entry._id,
		date: new Date(),
		currency: entry.currency,
		fxRateToPKR: entry.fxRateToPKR,
		narration: `Reversal of ${entry.entryNumber}${reason ? `: ${reason}` : ''}`,
		userId,
		lines: lines.map((line) => ({
			ledgerAccount: line.ledgerAccount,
			partyType: line.partyType,
			partyId: line.partyId,
			debit: line.credit,
			credit: line.debit,
			narration: line.narration,
		})),
	});

	entry.status = 'void';
	entry.voidedAt = new Date();
	entry.voidedBy = userId;
	entry.voidReason = reason;
	entry.reversingEntry = reversal._id;
	await entry.save();
	await JournalLine.updateMany(
		{ journalEntry: entry._id },
		{ $set: { status: 'void' } }
	);

	const parties = new Map();
	lines.forEach((line) => {
		if (line.partyType && line.partyType !== 'none' && line.partyId) {
			parties.set(`${line.partyType}:${line.partyId}:${entry.currency}`, {
				partyType: line.partyType,
				partyId: line.partyId,
				currency: entry.currency,
			});
		}
	});
	await Promise.all(
		[...parties.values()].map((p) =>
			rebuildPartyBalance(p.partyType, p.partyId, p.currency)
		)
	);
	return reversal;
};

const loadInvoiceForPosting = (id) =>
	Invoice.findById(id).populate({
		path: 'order',
		populate: {
			path: 'finalQuote',
			select: 'account currency',
			populate: { path: 'account', select: 'accountName' },
		},
	});

const postInvoiceIssued = async (invoiceId, userId) => {
	await ensureChartOfAccounts(userId);
	const invoice = await loadInvoiceForPosting(invoiceId);
	if (!invoice || invoice.status !== 'Issued') {
		throw new Error('Invoice is not in Issued status');
	}
	const existing = await findPostedJournal('invoice', invoice._id);
	if (existing) {
		await resolveFailure('invoice', invoice._id, userId, existing);
		return existing;
	}
	const accountId = invoice.order?.finalQuote?.account?._id || invoice.order?.finalQuote?.account;
	if (!accountId) {
		throw new Error('Cannot post invoice journal: customer account is missing on the quote');
	}
	const amount = round2(invoice.grandTotal);
	if (amount <= 0) {
		throw new Error('Cannot post invoice journal: grandTotal must be greater than 0');
	}
	const ar = await getAccountByCode('1200');
	const sales = await getAccountByCode('4100');
	const entry = await persistJournal({
		sourceType: 'invoice',
		sourceId: invoice._id,
		date: invoice.issuedAt || invoice.documentDate || new Date(),
		currency: invoice.currency || 'PKR',
		fxRateToPKR: fxRate(invoice.currency, 1),
		narration: `Invoice ${invoice.invoiceNumber}`,
		userId,
		lines: [
			{
				ledgerAccount: ar._id,
				partyType: 'customer',
				partyId: accountId,
				debit: amount,
				credit: 0,
			},
			{
				ledgerAccount: sales._id,
				partyType: 'none',
				debit: 0,
				credit: amount,
			},
		],
	});
	await resolveFailure('invoice', invoice._id, userId, entry);
	return entry;
};

const reverseInvoiceJournal = async (invoiceId, userId) => {
	await ensureChartOfAccounts(userId);
	const invoice = await Invoice.findById(invoiceId);
	if (!invoice) throw new Error('Invoice not found');
	const existing = await findPostedJournal('invoice', invoice._id);
	if (!existing) return null;
	const reversal = await voidAndReverse(
		existing,
		userId,
		`Invoice ${invoice.invoiceNumber} cancelled`
	);
	await resolveFailure('invoice', invoice._id, userId, reversal);
	return reversal;
};

const safePostInvoiceIssued = async (invoiceId, userId) => {
	try {
		return await postInvoiceIssued(invoiceId, userId);
	} catch (error) {
		console.error('Invoice journal post failed:', error);
		await recordFailure({
			sourceType: 'invoice',
			sourceId: invoiceId,
			action: 'issue',
			error,
			userId,
		});
		return null;
	}
};

const safeReverseInvoiceJournal = async (invoiceId, userId, wasIssued) => {
	if (!wasIssued) return null;
	try {
		return await reverseInvoiceJournal(invoiceId, userId);
	} catch (error) {
		console.error('Invoice journal reverse failed:', error);
		await recordFailure({
			sourceType: 'invoice',
			sourceId: invoiceId,
			action: 'cancel',
			error,
			userId,
		});
		return null;
	}
};

const postVendorBill = async (billId, userId) => {
	await ensureChartOfAccounts(userId);
	const bill = await VendorBill.findById(billId);
	if (!bill || bill.status !== 'posted') {
		throw new Error('Vendor bill is not posted');
	}
	const existing = await findPostedJournal('vendor_bill', bill._id);
	if (existing) {
		await resolveFailure('vendor_bill', bill._id, userId, existing);
		return existing;
	}
	const amount = round2(bill.grandTotal);
	if (amount <= 0) throw new Error('Vendor bill total must be greater than 0');
	const purchases = await getAccountByCode('5100');
	const ap = await getAccountByCode('2100');
	const entry = await persistJournal({
		sourceType: 'vendor_bill',
		sourceId: bill._id,
		date: bill.billDate || new Date(),
		currency: bill.currency || 'PKR',
		fxRateToPKR: fxRate(bill.currency, bill.fxRateToPKR),
		narration: `Vendor bill ${bill.billNumber}`,
		userId,
		lines: [
			{
				ledgerAccount: purchases._id,
				partyType: 'none',
				debit: amount,
				credit: 0,
			},
			{
				ledgerAccount: ap._id,
				partyType: 'vendor',
				partyId: bill.vendor,
				debit: 0,
				credit: amount,
			},
		],
	});
	bill.journalEntry = entry._id;
	await bill.save();
	await resolveFailure('vendor_bill', bill._id, userId, entry);
	return entry;
};

const reverseVendorBill = async (billId, userId) => {
	const bill = await VendorBill.findById(billId);
	if (!bill) throw new Error('Vendor bill not found');
	const existing = await findPostedJournal('vendor_bill', bill._id);
	if (!existing) return null;
	const reversal = await voidAndReverse(
		existing,
		userId,
		`Vendor bill ${bill.billNumber} cancelled`
	);
	await resolveFailure('vendor_bill', bill._id, userId, reversal);
	return reversal;
};

const postPayment = async (paymentId, userId) => {
	await ensureChartOfAccounts(userId);
	const payment = await Payment.findById(paymentId);
	if (!payment || payment.status !== 'posted') {
		throw new Error('Payment is not posted');
	}
	const existing = await findPostedJournal('payment', payment._id);
	if (existing) {
		await resolveFailure('payment', payment._id, userId, existing);
		return existing;
	}
	const amount = round2(payment.amount);
	const cash = await getAccountByCode(payment.cashAccountCode || '1110');
	const control = await getAccountByCode(
		payment.direction === 'inbound' ? '1200' : '2100'
	);
	const partyType = payment.partyType;
	const cashLine = {
		ledgerAccount: cash._id,
		partyType: 'none',
		debit: payment.direction === 'inbound' ? amount : 0,
		credit: payment.direction === 'outbound' ? amount : 0,
	};
	const controlLine = {
		ledgerAccount: control._id,
		partyType,
		partyId: payment.partyId,
		debit: payment.direction === 'outbound' ? amount : 0,
		credit: payment.direction === 'inbound' ? amount : 0,
	};
	const entry = await persistJournal({
		sourceType: 'payment',
		sourceId: payment._id,
		date: payment.date || new Date(),
		currency: payment.currency,
		fxRateToPKR: fxRate(payment.currency, payment.fxRateToPKR),
		narration: `Payment ${payment.paymentNumber}`,
		userId,
		lines: [cashLine, controlLine],
	});
	payment.journalEntry = entry._id;
	await payment.save();
	await resolveFailure('payment', payment._id, userId, entry);
	return entry;
};

const reversePayment = async (paymentId, userId) => {
	const payment = await Payment.findById(paymentId);
	if (!payment) throw new Error('Payment not found');
	const existing = await findPostedJournal('payment', payment._id);
	if (!existing) return null;
	const reversal = await voidAndReverse(
		existing,
		userId,
		`Payment ${payment.paymentNumber} voided`
	);
	await resolveFailure('payment', payment._id, userId, reversal);
	return reversal;
};

const retrySource = async ({ sourceType, sourceId, userId }) => {
	try {
		if (sourceType === 'invoice') {
			const invoice = await Invoice.findById(sourceId);
			if (!invoice) throw new Error('Invoice not found');
			if (invoice.status === 'Issued') {
				return postInvoiceIssued(sourceId, userId);
			}
			if (invoice.status === 'Cancelled') {
				const posted = await findPostedJournal('invoice', sourceId);
				if (!posted) {
					await JournalPostingFailure.findOneAndUpdate(
						{ sourceType: 'invoice', sourceId },
						{
							$set: {
								status: 'skipped',
								lastError: 'Cancelled invoice has no posted journal to reverse',
								lastAttemptAt: new Date(),
								resolvedAt: new Date(),
								resolvedBy: userId,
							},
						}
					);
					return null;
				}
				return reverseInvoiceJournal(sourceId, userId);
			}
			throw new Error('Invoice is not in a postable status');
		}
		if (sourceType === 'vendor_bill') {
			const bill = await VendorBill.findById(sourceId);
			if (!bill) throw new Error('Vendor bill not found');
			if (bill.status === 'posted') return postVendorBill(sourceId, userId);
			if (bill.status === 'cancelled') return reverseVendorBill(sourceId, userId);
			throw new Error('Vendor bill is still draft');
		}
		if (sourceType === 'payment') {
			const payment = await Payment.findById(sourceId);
			if (!payment) throw new Error('Payment not found');
			if (payment.status === 'posted') return postPayment(sourceId, userId);
			if (payment.status === 'void') return reversePayment(sourceId, userId);
			throw new Error('Payment is still draft');
		}
		throw new Error('Unsupported source type for retry');
	} catch (error) {
		if (error.code === DUPLICATE_KEY) {
			const existing = await findPostedJournal(sourceType, sourceId);
			if (existing) {
				await resolveFailure(sourceType, sourceId, userId, existing);
				return existing;
			}
		}
		throw error;
	}
};

module.exports = {
	ensureChartOfAccounts,
	findPostedJournal,
	persistJournal,
	postInvoiceIssued,
	reverseInvoiceJournal,
	safePostInvoiceIssued,
	safeReverseInvoiceJournal,
	postVendorBill,
	reverseVendorBill,
	postPayment,
	reversePayment,
	retrySource,
	recordFailure,
	resolveFailure,
	rebuildPartyBalance,
	fxRate,
	round2,
};
