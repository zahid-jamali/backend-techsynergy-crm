const Invoice = require('../models/Invoice');
const Quote = require('../models/Quotes');
const mongoose = require('mongoose');
const puppeteer = require('puppeteer');
const getInvoiceHtml = require('../lib/getInvoiceHtml');

const generateInvoicePdf = async (req, res) => {
	try {
		const order = await Invoice.findById(req.params.id).populate({
			path: 'sellOrder',
			populate: [{ path: 'account' }, { path: 'contact' }],
		});

		if (!order) {
			return res.status(404).send('Quote not found');
		}

		const browser = await puppeteer.launch({
			headless: 'new',
			args: ['--no-sandbox', '--disable-setuid-sandbox'],
		});

		const page = await browser.newPage();

		await page.setContent(getInvoiceHtml(order), {
			waitUntil: 'networkidle0',
		});

		const pdf = await page.pdf({
			format: 'A4',
			printBackground: true,
		});

		await browser.close();

		res.set({
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename=Quote-${order._id}.pdf`,
		});

		res.send(pdf);
	} catch (error) {
		console.error('PDF Error:', error);
		res.status(500).send('Failed to generate PDF');
	}
};

const createInvoice = async (req, res) => {
	try {
		const {
			documentDate,
			customerRefNo,
			description,
			sellOrder,
			transportation,
			termsAndConditions,
		} = req.body;

		/* ---- Validate Sell Order ---- */
		const quote = await Quote.findOne({
			_id: sellOrder,
			isActive: true,
		});

		if (!quote) {
			return res.status(404).json({
				message: 'Sell order (Quote) not found',
			});
		}

		/* ---- Prevent Duplicate Invoice on Same Quote ---- */
		const existingInvoice = await Invoice.findOne({
			sellOrder,
			isActive: true,
		});

		if (existingInvoice) {
			return res.status(409).json({
				message: 'Invoice already exists for this sell order',
			});
		}

		const count = await Invoice.countDocuments();
		const invoiceNumber = `INV-TS-${String(count + 1).padStart(5, '0')}`;

		const invoice = await Invoice.create({
			invoiceNumber,
			documentDate,
			customerRefNo,
			description,
			sellOrder,
			transportation,
			termsAndConditions,
		});

		return res.status(201).json({
			message: 'Invoice created successfully',
			data: invoice,
		});
	} catch (error) {
		console.error('Create Invoice Error:', error);
		return res.status(500).json({
			message: 'Failed to create invoice',
		});
	}
};

const getInvoices = async (req, res) => {
	try {
		const invoices = await Invoice.find({ isActive: true })
			.populate({
				path: 'sellOrder',
				populate: ['account', 'contact'],
			})
			.sort({ createdAt: -1 });

		return res.status(200).json({
			data: invoices,
		});
	} catch (error) {
		console.error('Get Invoices Error:', error);
		return res.status(500).json({
			message: 'Failed to fetch invoices',
		});
	}
};

const updateInvoice = async (req, res) => {
	try {
		const { id } = req.params;

		const invoice = await Invoice.findOne({
			_id: id,
			isActive: true,
		});

		if (!invoice) {
			return res.status(404).json({
				message: 'Invoice not found',
			});
		}

		if (invoice.status !== 'Draft') {
			return res.status(400).json({
				message: 'Only draft invoices can be updated',
			});
		}

		const allowedFields = [
			'documentDate',
			'customerRefNo',
			'description',
			'transportation',
			'termsAndConditions',
		];

		allowedFields.forEach((field) => {
			if (req.body[field] !== undefined) {
				invoice[field] = req.body[field];
			}
		});

		await invoice.save();

		return res.status(200).json({
			message: 'Invoice updated successfully',
			data: invoice,
		});
	} catch (error) {
		console.error('Update Invoice Error:', error);
		return res.status(500).json({
			message: 'Failed to update invoice',
		});
	}
};

const issueInvoice = async (req, res) => {
	try {
		const { id } = req.params;

		const invoice = await Invoice.findOne({
			_id: id,
			isActive: true,
		});

		if (!invoice) {
			return res.status(404).json({
				message: 'Invoice not found',
			});
		}

		if (invoice.status !== 'Draft') {
			return res.status(400).json({
				message: 'Only draft invoices can be issued',
			});
		}

		invoice.status = 'Issued';
		await invoice.save();

		return res.status(200).json({
			message: 'Invoice issued successfully',
			data: invoice,
		});
	} catch (error) {
		console.error('Issue Invoice Error:', error);
		return res.status(500).json({
			message: 'Failed to issue invoice',
		});
	}
};

const cancelInvoice = async (req, res) => {
	try {
		const { id } = req.params;

		const invoice = await Invoice.findOne({
			_id: id,
			isActive: true,
		});

		if (!invoice) {
			return res.status(404).json({
				message: 'Invoice not found',
			});
		}

		if (invoice.status === 'Cancelled') {
			return res.status(400).json({
				message: 'Invoice already cancelled',
			});
		}

		invoice.status = 'Cancelled';
		await invoice.save();

		return res.status(200).json({
			message: 'Invoice cancelled successfully',
		});
	} catch (error) {
		console.error('Cancel Invoice Error:', error);
		return res.status(500).json({
			message: 'Failed to cancel invoice',
		});
	}
};

const deleteInvoice = async (req, res) => {
	try {
		const { id } = req.params;

		const invoice = await Invoice.findById(id);

		if (!invoice) {
			return res.status(404).json({
				message: 'Invoice not found',
			});
		}

		invoice.isActive = false;
		await invoice.save();

		return res.status(200).json({
			message: 'Invoice deleted successfully',
		});
	} catch (error) {
		console.error('Delete Invoice Error:', error);
		return res.status(500).json({
			message: 'Failed to delete invoice',
		});
	}
};

module.exports = {
	createInvoice,
	getInvoices,
	updateInvoice,
	issueInvoice,
	cancelInvoice,
	deleteInvoice,
	generateInvoicePdf,
};
