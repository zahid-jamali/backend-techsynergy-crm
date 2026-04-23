const POToVendor = require('../models/POToVendor');
const puppeteer = require('puppeteer');
const getPOToVendorHtml = require('../lib/getPOToVendorHtml');
const Product = require('../models/Products');
const Vendor=require('../models/Vendors')

const generatePOToVendorPdf = async (req, res) => {
	try {
		const po = await POToVendor.findById(req.params.id)
  .sort({ createdAt: -1 })
  .populate({
    path: "refQuote",
    populate: [ 
      {
        path: "deal",
        select: "dealName",
      },
      {
        path: "quoteOwner",
      },
      {
        path: "account",
        select: "accountName",
      },
      {
        path: "contact",
        select: "name email phone",
      },
    ],
  }).populate('vendor');

		if (!po) {
			return res.status(404).send('Purchase Order not found');
		}

		const browser = await puppeteer.launch({
			headless: 'new',
			args: ['--no-sandbox', '--disable-setuid-sandbox'],
		});

		const page = await browser.newPage();

		await page.setContent(getPOToVendorHtml(po), {
			waitUntil: 'networkidle0',
		});

		const pdf = await page.pdf({
			format: 'A4',
			printBackground: true,
			margin: {
				top: '20mm',
				bottom: '20mm',
				left: '15mm',
				right: '15mm',
			},
		});

		await browser.close();

		res.set({
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename=PO-${po.poToNumber}.pdf`,
		});

		res.send(pdf);
	} catch (error) {
		console.error('PO PDF Error:', error);
		res.status(500).send('Failed to generate Purchase Order PDF');
	}
};

const updateMyProductPrices = async (products = []) => {
	if (!Array.isArray(products) || products.length === 0) return;
	await Promise.all(
		products.map(async (product) => {
			if (!product?.productName) return;
			const title = product.productName.trim().toLowerCase();
			const price = product.listPrice;
			try {
				await Product.findOneAndUpdate(
					{ title: title },
					{
						$set: {
							previousVendorPrice: Number(price),
						},
					},
					{
						new: true,
						upsert: true,
					}
				);
			} catch (err) {
				console.log(err);
			}
		})
	);
};


const createPOToVendor = async (req, res) => {
	try {
		const {
			subject,
			refQuote,
			Order,
			validUntil,
			termsAndConditions = [],
			products = [],
			vendor,
			Tax = [],
			description,
		} = req.body;

		/* ================= VALIDATION ================= */

		if (!subject || !subject.trim()) {
			return res.status(400).json({
				success: false,
				msg: 'Subject is required',
			});
		}

		if (!vendor) {
			return res.status(400).json({
				success: false,
				msg: 'Vendor is required',
			});
		}

		if (!Array.isArray(products) || products.length === 0) {
			return res.status(400).json({
				success: false,
				msg: 'At least one product is required',
			});
		}

		/* Validate vendor exists */

		const vendorExists = await Vendor.findById(vendor);

		if (!vendorExists) {
			return res.status(404).json({
				success: false,
				msg: 'Vendor not found',
			});
		}

		const round = (n) => Math.round(n * 100) / 100;

		/* ================= PRODUCTS CALCULATION ================= */

		let subTotal = 0;

		const calculatedProducts = products.map((p, index) => {
			const quantity = Number(p.quantity) || 1;
			const listPrice = Number(p.listPrice) || 0;

			const amount = quantity * listPrice;

			subTotal += amount;

			return {
				serialNo: index + 1,
				productName: p.productName?.trim(),
				quantity,
				listPrice,
				amount: round(amount),
				total: round(amount),
			};
		});

		subTotal = round(subTotal);

		/* ================= TAX CALCULATION ================= */

		let totalTaxAmount = 0;

		const calculatedTaxes = Array.isArray(Tax)
			? Tax.map((t) => {
					const percent = Number(t.percent) || 0;

					const taxAmount = round(
						(subTotal * percent) / 100
					);

					totalTaxAmount += taxAmount;

					return {
						tax: t.tax?.trim(),
						percent,
					};
			  })
			: [];

		totalTaxAmount = round(totalTaxAmount);

		/* ================= GRAND TOTAL ================= */

		const grandTotal = round(
			subTotal + totalTaxAmount
		);

		/* ================= GENERATE PO NUMBER ================= */

		const count = await POToVendor.countDocuments();

		const poToNumber =
			`PO-V-${String(count + 1).padStart(5, '0')}`;

		/* ================= CREATE PO ================= */

		const po = await POToVendor.create({
			poToNumber,
			subject: subject.trim(),
			refQuote,
			Order,
			validUntil,
			 vendor,
			termsAndConditions,
			products: calculatedProducts,
			Tax: calculatedTaxes,
			subTotal,
			grandTotal,
			description,
		});

		/* ================= OPTIONAL: UPDATE PRODUCT PRICES ================= */

		if (typeof updateMyProductPrices === 'function') {
			await updateMyProductPrices(products);
		}

		/* ================= OPTIONAL: UPDATE VENDOR STATS ================= */

		await Vendor.findByIdAndUpdate(
			vendor,
			{
				$inc: {
					'stats.totalPurchase': grandTotal,
					'stats.totalOrders': 1,
				},
				$set: {
					'stats.lastOrderDate': new Date(),
				},
			}
		);

		return res.status(201).json({
			success: true,
			msg: 'Purchase Order created successfully',
			data: po,
		});
	} catch (error) {
		console.error('Create PO Error:', error);

		if (error.code === 11000) {
			return res.status(400).json({
				success: false,
				msg: 'PO number already exists',
			});
		}

		return res.status(500).json({
			success: false,
			msg: 'Failed to create Purchase Order',
		});
	}
};



const getAllPOs = async (req, res) => {
	try {
		const pos = await POToVendor.find({ isActive: true })
  .sort({ createdAt: -1 })
  .populate({
    path: "refQuote",
    select: "deal account contact quoteNumber quoteOwner",
    populate: [
      {
        path: "deal",
        select: "dealName",
      },
      {
        path: "quoteOwner",
      },
      {
        path: "account",
        select: "accountName",
      },
      {
        path: "contact",
        select: "name email phone",
      },
    ],
  }).populate('vendor');

		return res.status(200).json({
			success: true,
			data: pos,
		});
	} catch (error) {
		console.error('Get POs Error:', error);
		return res.status(500).json({
			success: false,
			msg: 'Failed to fetch Purchase Orders',
		});
	}
};

const updatePOToVendor = async (req, res) => {
	try {
		const { id } = req.params;

		const {
			subject,
			refQuote,
			Order,
			validUntil,
			termsAndConditions = [],
			products = [],
			Tax = [],
			description,
		} = req.body;

		/* ================= FIND PO ================= */

		const po = await POToVendor.findById(id);

		if (!po) {
			return res.status(404).json({
				success: false,
				msg: "Purchase Order not found",
			});
		}

		/* ================= VALIDATION ================= */

		if (!subject || !subject.trim()) {
			return res.status(400).json({
				success: false,
				msg: "Subject is required",
			});
		}

		if (!Array.isArray(products) || products.length === 0) {
			return res.status(400).json({
				success: false,
				msg: "At least one product is required",
			});
		}

		const round = (n) => Math.round(n * 100) / 100;

		/* ================= PRODUCTS CALCULATION ================= */

		let subTotal = 0;

		const calculatedProducts = products.map((p, index) => {
			const quantity = Number(p.quantity) || 1;
			const listPrice = Number(p.listPrice) || 0;

			const amount = quantity * listPrice;

			subTotal += amount;

			return {
				serialNo: index + 1,
				productName: p.productName?.trim(),
				quantity,
				listPrice,
				amount: round(amount),
				total: round(amount),
			};
		});

		subTotal = round(subTotal);

		/* ================= TAX CALCULATION ================= */

		let totalTaxAmount = 0;

		const calculatedTaxes = Array.isArray(Tax)
			? Tax.map((t) => {
					const percent = Number(t.percent) || 0;

					const taxAmount = round(
						(subTotal * percent) / 100
					);

					totalTaxAmount += taxAmount;

					return {
						tax: t.tax?.trim(),
						percent,
					};
			  })
			: [];

		totalTaxAmount = round(totalTaxAmount);

		/* ================= GRAND TOTAL ================= */

		const grandTotal = round(
			subTotal + totalTaxAmount
		);

		/* ================= UPDATE PO ================= */

		po.subject = subject.trim();
		po.refQuote = refQuote;
		po.Order = Order;
		po.validUntil = validUntil;
		po.termsAndConditions = termsAndConditions;
		po.products = calculatedProducts;
		po.Tax = calculatedTaxes;
		po.subTotal = subTotal;
		po.grandTotal = grandTotal;
		po.description = description;

		await po.save();

		/* ================= OPTIONAL: UPDATE PRODUCT PRICES ================= */

		if (typeof updateMyProductPrices === "function") {
			await updateMyProductPrices(products);
		}

		return res.status(200).json({
			success: true,
			msg: "Purchase Order updated successfully",
			data: po,
		});
	} catch (error) {
		console.error("Update PO Error:", error);

		return res.status(500).json({
			success: false,
			msg: "Failed to update Purchase Order",
		});
	}
};

const deletePOToVendor = async (req, res) => {
	try {
		const { id } = req.params;

		// const {products}=

		const po = await POToVendor.findById(id);

		if (!po) {
			return res.status(404).json({
				success: false,
				msg: 'Purchase Order not found',
			});
		}

		po.isActive = false;
		await po.save();

		return res.status(200).json({
			success: true,
			msg: 'Purchase Order deleted successfully',
		});
	} catch (error) {
		console.error('Delete PO Error:', error);
		return res.status(500).json({
			success: false,
			msg: 'Failed to delete Purchase Order',
		});
	}
};

module.exports = {
	createPOToVendor,
	getAllPOs,
	updatePOToVendor,
	deletePOToVendor,
	generatePOToVendorPdf,
};
