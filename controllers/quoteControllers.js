const mongoose = require('mongoose');
const Quote = require('../models/Quotes');
const getNextSequence = require('../lib/getNextSequence.js');
const Product = require('../models/Products');
const convertCurrency = require('../lib/convertCurrency');
const Deals = require('../models/Deals');
const Contact = require('../models/Contacts');
const User = require('../models/Users');
const { sendPdf } = require('../lib/pdf/renderPdf');
const {
	parseListQuery,
	archiveMatch,
	regex,
	sendPage,
	paginate,
} = require('../lib/listQuery');
const { setArchived } = require('../lib/archiveRecord');
const { notifyQuoteConfirmed } = require('../lib/notifications');
const { mapQuoteProduct, quoteTotals } = require('../lib/quotePricing');
const ExcelJS = require('exceljs');
const { resolveRole } = require('../lib/middleware');

const generateQuotePdf = async (req, res) => {
	try {
		const quote = await Quote.findById(req.params.id)
			.populate('account')
			.populate('contact', 'firstName lastName email phone mobile')
			.populate('quoteOwner', 'name email designation');

		if (!quote) {
			return res.status(404).send('Quote not found');
		}

		const accountName = quote.account?.accountName || 'quote';
		return sendPdf(
			res,
			'QuoteDocument',
			{ quote: quote.toObject({ virtuals: true }) },
			`Q-${quote.quoteNumber || quote.subject}-${accountName}.pdf`
		);
	} catch (error) {
		console.error('PDF Error:', error);
		res.status(500).send('Failed to generate PDF');
	}
};

const createQuote = async (req, res) => {
	try {
		const {
			subject,
			deal,
			contact,
			validUntil,
			products,
			currency,
			description,
			termsAndConditions,
			otherTax = [],
		} = req.body;

		/* ---------------- VALIDATION ---------------- */

		if (!subject || !deal) {
			return res.status(400).json({
				success: false,
				msg: 'Subject and deal are required',
			});
		}

		if (!Array.isArray(products) || products.length === 0) {
			return res.status(400).json({
				success: false,
				msg: 'At least one product is required',
			});
		}

		/* ---------------- PRODUCT CALCULATIONS ---------------- */

		const calculatedProducts = products.map((p, index) => mapQuoteProduct(p, index));
		const totals = quoteTotals(calculatedProducts, otherTax);
		const subTotal = totals.subTotal;
		const calculatedOtherTaxes = totals.otherTax;
		const taxAmount = totals.otherTaxAmount;
		const grandTotal = totals.grandTotal;

		/* ---------------- GET ACCOUNT FROM DEAL ---------------- */

		const dealTmp = await Deals.findById(deal);

		if (!dealTmp || dealTmp.isActive === false) {
			return res.status(404).json({
				success: false,
				msg: 'Deal not found',
			});
		}

		const account = dealTmp.account;

		if (contact) {
			if (!mongoose.Types.ObjectId.isValid(contact)) {
				return res.status(400).json({
					success: false,
					msg: 'Invalid contact ID',
				});
			}
			const contactDoc = await Contact.findOne({
				_id: contact,
				isActive: true,
				isArchived: { $ne: true },
			});
			if (!contactDoc) {
				return res.status(404).json({
					success: false,
					msg: 'Contact not found or archived',
				});
			}
			if (
				contactDoc.account &&
				String(contactDoc.account) !== String(account)
			) {
				return res.status(400).json({
					success: false,
					msg: 'Contact does not belong to the deal account',
				});
			}
		}

		/* ---------------- GENERATE QUOTE NUMBER ---------------- */

		const seq = await getNextSequence('quotation');

		const quoteNumber = `TIPL-${String(seq).padStart(5, '0')}`;

		/* ---------------- CREATE QUOTE ---------------- */

		const quote = await Quote.create({
			quoteOwner: req.user.id,

			subject: subject.trim(),

			deal,
			account,
			contact,

			validUntil,

			products: calculatedProducts,

			termsAndConditions,

			description,

			quoteNumber,

			currency,

			otherTax: calculatedOtherTaxes,

			subTotal,
			otherTaxAmount: taxAmount,
			grandTotal,
		});

		/* ---------------- UPDATE PRODUCT PRICE HISTORY ---------------- */

		await Promise.all(
			products.map(async (p) => {
				if (!p.productName) return;

				await Product.findOneAndUpdate(
					{
						title: p.productName.trim(),
					},
					{
						$set: {
							previousQuotePrice: Number(p.listPrice) || 0,
						},
					},
					{
						new: true,
						upsert: true,
					}
				);
			})
		);

		return res.status(201).json({
			success: true,
			msg: 'Quote created successfully',
			data: quote,
		});
	} catch (error) {
		console.error('Create Quote Error:', error);

		return res.status(500).json({
			success: false,
			msg: 'Server error while creating quote',
		});
	}
};

const getMyQuotes = async (req, res) => {
	try {
		const { page, limit, search, archived } = parseListQuery(req);
		const filter = {
			quoteOwner: req.user.id,
			isActive: true,
			...archiveMatch(archived),
		};
		if (req.query.stage) filter.quoteStage = req.query.stage;
		if (req.query.excludeStage) {
			const stages = String(req.query.excludeStage)
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean);
			if (stages.length) filter.quoteStage = { $nin: stages };
		}
		if (req.query.isSOApproved === 'true') filter.isSOApproved = true;
		if (req.query.isSOApproved === 'false') filter.isSOApproved = false;
		if (search) {
			filter.$or = [{ subject: regex(search) }, { quoteNumber: regex(search) }];
		}

		const result = await paginate(Quote, {
			filter,
			page,
			limit,
			populate: [
				{ path: 'deal', select: 'dealName' },
				{ path: 'account', select: 'accountName' },
				{ path: 'contact', select: 'firstName lastName' },
				{ path: 'quoteOwner', select: 'name email' },
			],
		});
		return sendPage(res, result.data, result);
	} catch (error) {
		console.error('Get Quotes Error:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to fetch quotes',
		});
	}
};

const updateQuote = async (req, res) => {
	try {
		const { id } = req.params;

		const quote = await Quote.findOne({
			_id: id,
			isActive: true,
		});

		if (!quote) {
			return res.status(404).json({
				success: false,
				msg: 'Quote not found',
			});
		}

		const previousStage = quote.quoteStage;

		const {
			subject,
			quoteStage,
			validUntil,
			description,
			products,
			termsAndConditions,
			currency,
			otherTax,
		} = req.body;
		console.log(JSON.stringify(products[0].Tax));

		/* ================= BASIC FIELDS ================= */

		if (subject !== undefined) quote.subject = subject.trim();

		if (quoteStage !== undefined) quote.quoteStage = quoteStage;

		if (validUntil !== undefined) quote.validUntil = validUntil;

		if (description !== undefined) quote.description = description;

		if (currency !== undefined) quote.currency = currency;

		if (termsAndConditions !== undefined)
			quote.termsAndConditions = termsAndConditions;

		let subTotal = quote.subTotal || 0;
		let taxAmount = quote.otherTaxAmount || 0;
		let grandTotal = quote.grandTotal || 0;

		/* ================= PRODUCTS ================= */

		if (Array.isArray(products)) {
			if (products.length === 0) {
				return res.status(400).json({
					success: false,
					msg: 'At least one product is required',
				});
			}

			quote.products = products.map((p, index) => mapQuoteProduct(p, index));
		}

		const totals = quoteTotals(
			quote.products,
			Array.isArray(otherTax) ? otherTax : quote.otherTax
		);
		subTotal = totals.subTotal;
		if (Array.isArray(otherTax)) quote.otherTax = totals.otherTax;
		taxAmount = totals.otherTaxAmount;
		grandTotal = totals.grandTotal;

		quote.subTotal = subTotal;
		quote.otherTaxAmount = taxAmount;
		quote.grandTotal = grandTotal;

		await quote.save();
		await notifyQuoteConfirmed(quote, previousStage, req.user);

		return res.json({
			success: true,
			msg: 'Quote updated successfully',
			data: quote,
		});
	} catch (error) {
		console.error('Update Quote Error:', error);

		return res.status(500).json({
			success: false,
			msg: 'Failed to update quote',
		});
	}
};

const updateQuoteStage = async (req, res) => {
	try {
		const { id } = req.params;
		const { quoteStage, probability } = req.body;

		const quote = await Quote.findById(id);

		if (!quote) {
			return res.status(404).json({
				success: false,
				msg: 'Quote not found',
			});
		}

		const previousStage = quote.quoteStage;

		const usr = await User.findById(req.user.id);
		// if (quoteStage === 'Confirmed') {
		// 	if (!req.file) {
		// 		return res.status(400).json({
		// 			success: false,
		// 			msg: 'Purchase Order is required to confirm quote',
		// 		});
		// 	}

		// 	quote.purchaseOrder = {
		// 		public_id: req.file.filename,
		// 		url: `${req.file.path}`, //req.file.path,
		// 	};

		// 	quote.confirmedDate = new Date();

		// 	if (usr.isSuperUser) {
		// 		quote.isSOApproved = true;
		// 		const owner = quote.quoteOwner;

		// 		if (quote.currency === 'USD') {
		// 			totalInPKR = convertCurrency(quote.subTotal, 'USD', 'PKR');
		// 			owner.totalSell = (owner.totalSell || 0) + totalInPKR;
		// 		} else {
		// 			owner.totalSell = (owner.totalSell || 0) + quote.subTotal;
		// 		}

		// 		owner.totalSell = (owner.totalSell || 0) + quote.subTotal;
		// 		await owner.save();
		// 	}
		// } else {
		// 	if (req.file) {
		// 		return res.status(400).json({
		// 			success: false,
		// 			msg: 'Purchase Order can only be uploaded when confirming the quote',
		// 		});
		// 	}
		// }

		if (quoteStage === 'Submit') {
			const deal = await Deals.findById(quote.deal);
			deal.amount = quote.grandTotal;
			deal.currency = quote.currency;
			deal.closingDate = quote.validUntil;
			deal.dealStage ='Proposal/Price Quote',
			deal.probability=60;
			console.log(deal);
			await deal.save();
		}

		quote.quoteStage = quoteStage === 'Submit' ? 'Delivered' : quoteStage;
		await quote.save();
		await notifyQuoteConfirmed(quote, previousStage, req.user);

		return res.json({
			success: true,
			msg: 'Quote stage updated successfully',
			data: quote,
		});
	} catch (error) {
		console.error('Update Quote Stage Error:', error);
		return res.status(500).json({
			success: false,
			msg: 'Failed to update quote stage',
		});
	}
};

// =======================================================================================
// Admin Area
// =======================================================================================

const getAllQuotes = async (req, res) => {
	try {
		const { page, limit, search, archived } = parseListQuery(req);
		const filter = { isActive: true, ...archiveMatch(archived) };
		if (req.query.stage) filter.quoteStage = req.query.stage;
		if (req.query.owner) filter.quoteOwner = req.query.owner;
		if (req.query.excludeStage) {
			const stages = String(req.query.excludeStage)
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean);
			if (stages.length) filter.quoteStage = { $nin: stages };
		}
		if (req.query.isSOApproved === 'true') filter.isSOApproved = true;
		if (req.query.isSOApproved === 'false') filter.isSOApproved = false;
		if (search) {
			filter.$or = [{ subject: regex(search) }, { quoteNumber: regex(search) }];
		}
		const result = await paginate(Quote, {
			filter,
			page,
			limit,
			populate: [
				{ path: 'deal', select: 'dealName' },
				{ path: 'account', select: 'accountName' },
				{ path: 'contact', select: 'firstName lastName' },
				{ path: 'quoteOwner', select: 'name email' },
			],
		});
		return sendPage(res, result.data, result);
	} catch (error) {
		console.error('Get Quotes Error:', error);
		return res.status(500).json({
			success: false,
			msg: 'Failed to fetch quotes',
		});
	}
};

const generateCostingSheet = async (req, res) => {
	try {
		const quote = await Quote.findById(req.params.id)
			.populate('account', 'accountName')
			.populate('contact', 'firstName lastName')
			.populate('quoteOwner', 'name')
			.populate('deal', 'dealName');

		if (!quote || quote.isActive === false) {
			return res.status(404).json({ success: false, msg: 'Quote not found' });
		}

		const role = resolveRole(req.user);
		const ownerId = quote.quoteOwner?._id || quote.quoteOwner;
		if (role !== 'admin' && String(ownerId) !== String(req.user.id)) {
			return res.status(403).json({
				success: false,
				msg: 'You cannot download this costing sheet',
			});
		}

		const products = quote.products || [];
		const totals = quoteTotals(products, quote.otherTax);
		const currency = quote.currency || 'PKR';
		const brand = '021D54';
		const moneyFmt = '#,##0.00';

		const workbook = new ExcelJS.Workbook();
		workbook.creator = 'TechSynergy CRM';
		workbook.created = new Date();
		const sheet = workbook.addWorksheet('Costing Sheet', {
			views: [{ state: 'frozen', ySplit: 8, xSplit: 0 }],
			pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
		});

		sheet.columns = [
			{ width: 8 },
			{ width: 22 },
			{ width: 28 },
			{ width: 10 },
			{ width: 14 },
			{ width: 14 },
			{ width: 12 },
			{ width: 14 },
			{ width: 16 },
			{ width: 16 },
			{ width: 10 },
			{ width: 14 },
			{ width: 14 },
			{ width: 14 },
			{ width: 14 },
			{ width: 14 },
		];

		sheet.mergeCells('A1:P1');
		sheet.getCell('A1').value = 'TECHSYNERGY — INTERNAL COSTING SHEET';
		sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
		sheet.getCell('A1').fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: `FF${brand}` },
		};
		sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
		sheet.getRow(1).height = 28;

		sheet.mergeCells('A2:P2');
		sheet.getCell('A2').value =
			'Confidential — for internal pricing only. Not for customer circulation.';
		sheet.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF6B7280' } };

		const meta = [
			['Quote No', quote.quoteNumber || '-'],
			['Subject', quote.subject || '-'],
			['Account', quote.account?.accountName || '-'],
			['Deal', quote.deal?.dealName || '-'],
			['Owner', quote.quoteOwner?.name || '-'],
			['Currency', currency],
			['Stage', quote.quoteStage || '-'],
			['Date', new Date().toLocaleDateString()],
		];
		sheet.getCell('A4').value = 'Quote';
		sheet.getCell('B4').value = meta[0][1];
		sheet.getCell('C4').value = 'Subject';
		sheet.getCell('D4').value = meta[1][1];
		sheet.getCell('E4').value = 'Account';
		sheet.getCell('F4').value = meta[2][1];
		sheet.getCell('H4').value = 'Deal';
		sheet.getCell('I4').value = meta[3][1];
		sheet.getCell('A5').value = 'Owner';
		sheet.getCell('B5').value = meta[4][1];
		sheet.getCell('C5').value = 'Currency';
		sheet.getCell('D5').value = meta[5][1];
		sheet.getCell('E5').value = 'Stage';
		sheet.getCell('F5').value = meta[6][1];
		sheet.getCell('H5').value = 'Prepared';
		sheet.getCell('I5').value = meta[7][1];
		['A4', 'C4', 'E4', 'H4', 'A5', 'C5', 'E5', 'H5'].forEach((ref) => {
			sheet.getCell(ref).font = { bold: true, color: { argb: `FF${brand}` } };
		});

		sheet.mergeCells('A6:P6');
		sheet.getCell('A6').value =
			'Calculation: Vendor price → Margin % → Price after margin → Withholding tax (after margin) → List price. Product tax is then applied on list amount.';
		sheet.getCell('A6').font = { size: 9, color: { argb: 'FF4B5563' } };

		const headers = [
			'S.No',
			'Product',
			'Description',
			'Qty',
			'Vendor / Unit',
			'Vendor amount',
			'Margin %',
			'Margin amount',
			'After margin / unit',
			'After margin amount',
			'WHT %',
			'WHT amount',
			'List / unit',
			'Line amount',
			'Product tax',
			'Line total',
		];
		const headerRow = sheet.getRow(8);
		headers.forEach((label, i) => {
			const cell = headerRow.getCell(i + 1);
			cell.value = label;
			cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
			cell.fill = {
				type: 'pattern',
				pattern: 'solid',
				fgColor: { argb: `FF${brand}` },
			};
			cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
			cell.border = {
				top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
				left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
				bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
				right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
			};
		});
		headerRow.height = 32;

		products.forEach((p, index) => {
			const qty = Number(p.quantity) || 0;
			const vendor = Number(p.vendorPrice) || 0;
			const afterMargin = Number(p.priceAfterMargin) || 0;
			const marginAmt = (afterMargin - vendor) * qty;
			const whtAmt = (Number(p.withHoldingAmount) || 0) * qty;
			const row = sheet.addRow([
				p.serialNo || index + 1,
				p.productName || '',
				p.description || '',
				qty,
				vendor,
				vendor * qty,
				Number(p.margin) || 0,
				marginAmt,
				afterMargin,
				afterMargin * qty,
				Number(p.withHolding) || 0,
				whtAmt,
				Number(p.listPrice) || 0,
				Number(p.amount) || 0,
				Number(p.taxAmount) || 0,
				Number(p.total) || 0,
			]);
			row.alignment = { vertical: 'middle' };
			row.eachCell((cell, col) => {
				cell.border = {
					top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
					left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
					bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
					right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
				};
				cell.font = { size: 9 };
				if (index % 2 === 1) {
					cell.fill = {
						type: 'pattern',
						pattern: 'solid',
						fgColor: { argb: 'FFF8FAFC' },
					};
				}
				if ([5, 6, 8, 9, 10, 12, 13, 14, 15, 16].includes(col)) {
					cell.numFmt = moneyFmt;
				}
				if ([4, 7, 11].includes(col)) {
					cell.alignment = { horizontal: 'center' };
				}
			});
		});

		const summaryStart = 10 + products.length;
		const addTotal = (rowNum, label, value, emphasize = false) => {
			sheet.mergeCells(`A${rowNum}:O${rowNum}`);
			sheet.getCell(`A${rowNum}`).value = label;
			sheet.getCell(`A${rowNum}`).alignment = { horizontal: 'right' };
			sheet.getCell(`A${rowNum}`).font = {
				bold: emphasize,
				size: emphasize ? 11 : 9,
				color: { argb: emphasize ? 'FFFFFFFF' : `FF${brand}` },
			};
			sheet.getCell(`P${rowNum}`).value = value;
			sheet.getCell(`P${rowNum}`).numFmt = moneyFmt;
			sheet.getCell(`P${rowNum}`).font = {
				bold: true,
				size: emphasize ? 11 : 9,
				color: { argb: emphasize ? 'FFFFFFFF' : `FF${brand}` },
			};
			if (emphasize) {
				['A', 'P'].forEach((col) => {
					sheet.getCell(`${col}${rowNum}`).fill = {
						type: 'pattern',
						pattern: 'solid',
						fgColor: { argb: `FF${brand}` },
					};
				});
			}
		};

		addTotal(summaryStart, `Vendor total (${currency})`, totals.vendorTotal);
		addTotal(summaryStart + 1, `Margin total (${currency})`, totals.marginTotal);
		addTotal(
			summaryStart + 2,
			`Withholding total — after margin (${currency})`,
			totals.withHoldingTotal
		);
		addTotal(summaryStart + 3, `Subtotal / list (${currency})`, totals.subTotal);
		addTotal(
			summaryStart + 4,
			`Other tax (${currency})`,
			totals.otherTaxAmount
		);
		addTotal(
			summaryStart + 5,
			`Grand total (${currency})`,
			totals.grandTotal,
			true
		);

		sheet.mergeCells(`A${summaryStart + 7}:P${summaryStart + 7}`);
		sheet.getCell(`A${summaryStart + 7}`).value =
			'Withholding tax is applied after margin. Customer quotation PDF shows list prices only.';
		sheet.getCell(`A${summaryStart + 7}`).font = {
			italic: true,
			size: 9,
			color: { argb: 'FF6B7280' },
		};

		const fileName = `Costing-${quote.quoteNumber || quote._id}.xlsx`;
		res.setHeader(
			'Content-Type',
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
		);
		res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
		await workbook.xlsx.write(res);
		res.end();
	} catch (error) {
		console.error('Costing sheet error:', error);
		return res.status(500).json({
			success: false,
			msg: 'Failed to generate costing sheet',
		});
	}
};

const archiveQuote = async (req, res) => {
	try {
		const archived = req.body.archived !== false;
		const quote = await setArchived(Quote, {
			id: req.params.id,
			user: req.user,
			ownerField: 'quoteOwner',
			archived,
		});
		if (!quote) {
			return res.status(404).json({ success: false, msg: 'Quote not found' });
		}
		return res.json({
			success: true,
			msg: archived ? 'Quote archived' : 'Quote restored',
			data: quote,
		});
	} catch (error) {
		console.error(error);
		return res.status(500).json({ success: false, msg: 'Failed to archive quote' });
	}
};

module.exports = {
	createQuote,
	getMyQuotes,
	updateQuote,
	updateQuoteStage,
	generateQuotePdf,
	generateCostingSheet,
	getAllQuotes,
	archiveQuote,
};

// const getQuoteById = async (req, res) => {
// 	try {
// 		const { id } = req.params;

// 		if (!mongoose.Types.ObjectId.isValid(id)) {
// 			return res.status(400).json({
// 				success: false,
// 				msg: 'Invalid quote ID',
// 			});
// 		}

// 		const quote = await Quote.findOne({
// 			_id: id,
// 			isActive: true,
// 		})
// 			.populate('deal', 'dealName')
// 			.populate('account', 'accountName')
// 			.populate('contact', 'firstName lastName email phone');

// 		if (!quote) {
// 			return res.status(404).json({
// 				success: false,
// 				msg: 'Quote not found',
// 			});
// 		}

// 		return res.json({
// 			success: true,
// 			data: quote,
// 		});
// 	} catch (error) {
// 		console.error('Get Quote Error:', error);
// 		return res.status(500).json({
// 			success: false,
// 			msg: 'Failed to fetch quote',
// 		});
// 	}
// };

// const deleteQuote = async (req, res) => {
// 	try {
// 		await Quote.findByIdAndUpdate(req.params.id, {
// 			isActive: false,
// 		});

// 		return res.json({
// 			success: true,
// 			msg: 'Quote deleted successfully',
// 		});
// 	} catch (error) {
// 		console.error('Delete Quote Error:', error);
// 		return res.status(500).json({
// 			success: false,
// 			msg: 'Failed to delete quote',
// 		});
// 	}
// };
