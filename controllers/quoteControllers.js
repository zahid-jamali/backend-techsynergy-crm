const mongoose = require('mongoose');
const Quote = require('../models/Quotes');
const puppeteer = require('puppeteer');
const getQuoteHtml = require('../lib/QuotePdfTemplate.jsx');
const getNextSequence = require('../lib/getNextSequence.js');
const Product = require('../models/Products');
const convertCurrency = require('../lib/convertCurrency');
const Deals = require('../models/Deals');

const generateQuotePdf = async (req, res) => {
	try {
		const quote = await Quote.findById(req.params.id)
			.populate('account')
			.populate('contact', 'firstName lastName email phone')
			.populate('quoteOwner');

		if (!quote) {
			return res.status(404).send('Quote not found');
		}
		console.log(quote);

		const browser = await puppeteer.launch({
			headless: 'new',
			args: ['--no-sandbox', '--disable-setuid-sandbox'],
		});

		const page = await browser.newPage();

		await page.setContent(getQuoteHtml(quote), {
			waitUntil: 'networkidle0',
		});

		const pdf = await page.pdf({
			format: 'A4',
			printBackground: true,
		});

		await browser.close();

		res.set({
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename=Quote-${quote._id}.pdf`,
		});

		res.send(pdf);
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
			isGstApplied,
			gstRate = 18,
			termsAndConditions,
			otherTax = [], // NEW
		} = req.body;

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

		const round = (n) => Math.round(n * 100) / 100;

		/* ---------------- PRODUCT CALCULATIONS ---------------- */

		let subTotal = 0;
		let discountTotal = 0;

		const calculatedProducts = products.map((p, index) => {
			const quantity = Number(p.quantity) || 1;
			const listPrice = Number(p.listPrice) || 0;
			const discount = Number(p.discount) || 0;

			const amount = quantity * listPrice;
			const total = amount - discount;

			subTotal += amount;
			discountTotal += discount;

			return {
				serialNo: index + 1,
				productName: p.productName,
				description: p.description || '',
				quantity,
				listPrice,
				discount,
				amount: round(amount),
				total: round(total),
			};
		});

		subTotal = round(subTotal);
		discountTotal = round(discountTotal);

		const taxableAmount = subTotal - discountTotal;

		/* ---------------- GST CALCULATION ---------------- */

		let gstAmount = 0;

		if (isGstApplied === true) {
			gstAmount = round((taxableAmount * Number(gstRate)) / 100);
		}

		/* ---------------- OTHER TAX CALCULATION ---------------- */

		let otherTaxAmount = 0;

		const calculatedOtherTaxes = Array.isArray(otherTax)
			? otherTax.map((t) => {
					const percent = Number(t.percent) || 0;
					const taxValue = round((taxableAmount * percent) / 100);

					otherTaxAmount += taxValue;

					return {
						tax: t.tax,
						percent,
					};
				})
			: [];

		otherTaxAmount = round(otherTaxAmount);

		/* ---------------- GRAND TOTAL ---------------- */

		const grandTotal = round(taxableAmount + gstAmount + otherTaxAmount);

		/* ---------------- GET ACCOUNT FROM DEAL ---------------- */

		const dealTmp = await Deals.findById(deal);
		if (!dealTmp) {
			return res.status(404).json({
				success: false,
				msg: 'Deal not found',
			});
		}

		const account = dealTmp.account;

		/* ---------------- GENERATE QUOTE NUMBER ---------------- */

		const seq = await getNextSequence('quotation');
		const quoteNumber = `TS-QUO-${String(seq).padStart(5, '0')}`;

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
			isGstApplied: Boolean(isGstApplied),
			gstRate,
			gstAmount,
			otherTax: calculatedOtherTaxes,
			otherTaxAmount,
			subTotal,
			discountTotal,
			grandTotal,
		});

		/* ---------------- UPDATE PRODUCT PRICE HISTORY ---------------- */

		await Promise.all(
			products.map(async (p) => {
				if (!p.productName) return;

				await Product.findOneAndUpdate(
					{ title: p.productName.trim() },
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
		const quotes = await Quote.find({
			quoteOwner: req.user.id,
			isActive: true,
		})
			.populate('deal', 'dealName')
			.populate('account', 'accountName')
			.populate('contact', 'firstName lastName')
			.sort({ createdAt: -1 });

		return res.json({
			success: true,
			data: quotes,
		});
	} catch (error) {
		console.error('Get Quotes Error:', error);
		return res.status(500).json({
			success: false,
			msg: 'Failed to fetch quotes',
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

		const {
			subject,
			quoteStage,
			validUntil,
			description,
			products,
			isGstApplied,
			currency,
			otherTax, // ✅ NEW
		} = req.body;

		if (subject !== undefined) quote.subject = subject.trim();
		if (quoteStage !== undefined) quote.quoteStage = quoteStage;
		if (validUntil !== undefined) quote.validUntil = validUntil;
		if (description !== undefined) quote.description = description;
		if (currency !== undefined) quote.currency = currency;

		const GST_RATE = 0.18;
		const round = (n) => Math.round(n * 100) / 100;

		let subTotal = 0;
		let discountTotal = 0;

		/* ================= PRODUCTS ================= */

		if (Array.isArray(products)) {
			quote.products = products.map((p, index) => {
				const quantity = Number(p.quantity) || 1;
				const listPrice = Number(p.listPrice) || 0;
				const discount = Number(p.discount) || 0;

				const amount = quantity * listPrice;
				const total = amount - discount;

				subTotal += amount;
				discountTotal += discount;

				return {
					serialNo: index + 1,
					productName: p.productName,
					description: p.description || '',
					quantity,
					listPrice,
					discount,
					amount: round(amount),
					total: round(total),
				};
			});
		} else {
			// If products not sent, keep previous values
			subTotal = quote.subTotal || 0;
			discountTotal = quote.discountTotal || 0;
		}

		subTotal = round(subTotal);
		discountTotal = round(discountTotal);

		const taxableAmount = subTotal - discountTotal;

		/* ================= GST ================= */

		const nowGstApplied = isGstApplied === true;

		let gstAmount = 0;
		if (nowGstApplied) {
			gstAmount = round(taxableAmount * GST_RATE);
		}

		quote.isGstApplied = nowGstApplied;
		quote.gstAmount = gstAmount;

		/* ================= OTHER TAX ================= */

		let otherTaxAmount = 0;

		if (Array.isArray(otherTax)) {
			const calculatedOtherTaxes = otherTax.map((t) => {
				const percent = Number(t.percent) || 0;
				const taxValue = round((taxableAmount * percent) / 100);

				otherTaxAmount += taxValue;

				return {
					tax: t.tax,
					percent,
				};
			});

			quote.otherTax = calculatedOtherTaxes;
		}

		otherTaxAmount = round(otherTaxAmount);
		quote.otherTaxAmount = otherTaxAmount;

		/* ================= FINAL TOTAL ================= */

		quote.subTotal = subTotal;
		quote.discountTotal = discountTotal;
		quote.grandTotal = round(taxableAmount + gstAmount + otherTaxAmount);

		await quote.save();

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
		const { quoteStage } = req.body;

		const allowedStages = [
			'Draft',
			'Negotiation',
			'Delivered',
			'On Hold',
			'Confirmed',
			'Closed Won',
			'Closed Lost',
		];

		if (!allowedStages.includes(quoteStage)) {
			return res.status(400).json({
				success: false,
				msg: 'Invalid quote stage',
			});
		}

		const quote = await Quote.findById(id);

		if (!quote) {
			return res.status(404).json({
				success: false,
				msg: 'Quote not found',
			});
		}

		// 🚨 PO RULES
		if (quoteStage === 'Confirmed') {
			if (!req.file) {
				return res.status(400).json({
					success: false,
					msg: 'Purchase Order is required to confirm quote',
				});
			}

			quote.purchaseOrder = {
				public_id: req.file.filename,
				url: req.file.path,
			};
			quote.confirmedDate = new Date();
		} else {
			if (req.file) {
				return res.status(400).json({
					success: false,
					msg: 'Purchase Order can only be uploaded when confirming the quote',
				});
			}
		}

		quote.quoteStage = quoteStage;
		await quote.save();

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
		const quotes = await Quote.find({})
			.populate('deal', 'dealName')
			.populate('account', 'accountName')
			.populate('contact', 'firstName lastName')
			.populate('quoteOwner')
			.sort({ createdAt: -1 });

		return res.json({
			success: true,
			data: quotes,
		});
	} catch (error) {
		console.error('Get Quotes Error:', error);
		return res.status(500).json({
			success: false,
			msg: 'Failed to fetch quotes',
		});
	}
};

const soApproval = async (req, res) => {
	const { id } = req.params;

	try {
		const quote = await Quote.findById(id).populate('quoteOwner');

		if (!quote) {
			return res.status(404).send({ msg: 'Quote not found' });
		}

		if (!quote.grandTotal || isNaN(quote.grandTotal)) {
			return res.status(400).send({
				msg: 'Invalid quote amount',
			});
		}

		quote.isSOApproved = true;
		await quote.save();

		const owner = quote.quoteOwner;

		if (quote.currency === 'USD') {
			totalInPKR = convertCurrency(quote.subTotal, 'USD', 'PKR');
			owner.totalSell = (owner.totalSell || 0) + totalInPKR;
		} else {
			owner.totalSell = (owner.totalSell || 0) + quote.subTotal;
		}

		owner.totalSell = (owner.totalSell || 0) + quote.subTotal;
		await owner.save();

		return res.status(200).send(quote);
	} catch (error) {
		console.error(error);
		return res.status(500).send({ msg: 'Internal Server error!!!' });
	}
};

module.exports = {
	createQuote,
	getMyQuotes,
	updateQuote,
	updateQuoteStage,
	generateQuotePdf,
	getAllQuotes,
	soApproval,
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
