const Order = require('../models/Order');
const puppeteer = require('puppeteer');
const getInvoiceHtml = require('../lib/getInvoiceHtml');
const getDeliveryNoteHtml = require('../lib/getDeliveryNoteHtml');

const generateInvoicePdf = async (req, res) => {
	try {
		const { id } = req.params;

		/*
		==============================
		FIND ORDER
		==============================
		*/

		const order = await Order.findById(id)
			.populate({
				path: 'finalQuote',
				populate: [{ path: 'account' }, { path: 'contact' }],
			})
			.populate('createdBy');

		if (!order || !order.isActive) {
			return res.status(404).json({
				success: false,
				message: 'Order not found',
			});
		}

		/*
		==============================
		CHECK APPROVAL
		==============================
		*/

		if (!order.isSOApproved) {
			return res.status(400).json({
				success: false,
				message: 'Invoice can only be generated after approval',
			});
		}

		/*
		==============================
		LAUNCH BROWSER
		==============================
		*/

		const browser = await puppeteer.launch({
			headless: true,
			args: ['--no-sandbox', '--disable-setuid-sandbox'],
		});

		const page = await browser.newPage();

		/*
		==============================
		GENERATE HTML
		==============================
		*/

		const html = getInvoiceHtml(order);

		await page.setContent(html, {
			waitUntil: 'networkidle0',
		});

		/*
		==============================
		GENERATE PDF
		==============================
		*/

		const pdf = await page.pdf({
			format: 'A4',
			printBackground: true,
			margin: {
				top: '20px',
				right: '20px',
				bottom: '20px',
				left: '20px',
			},
		});

		await browser.close();

		/*
		==============================
		RESPONSE
		==============================
		*/

		res.set({
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename=Invoice-${order.orderNumber || order._id}.pdf`,
		});

		return res.send(pdf);
	} catch (error) {
		console.error('Invoice PDF Error:', error);

		return res.status(500).json({
			success: false,
			message: 'Failed to generate invoice PDF',
		});
	}
};

const generateDeliveryNotePdf = async (req, res) => {
	try {
		const order = await Order.findById(req.params.id).populate({
			path: 'finalQuote',
			populate: [{ path: 'account' }, { path: 'contact' }],
		});

		if (!order) {
			return res.status(404).json({ message: 'Order not found' });
		}

		const browser = await puppeteer.launch({
			headless: true,
			args: ['--no-sandbox', '--disable-setuid-sandbox'],
		});

		const page = await browser.newPage();

		await page.setContent(getDeliveryNoteHtml(order), {
			waitUntil: 'networkidle0',
		});

		const pdf = await page.pdf({
			format: 'A4',
			printBackground: true,
		});

		await browser.close();

		res.set({
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename=Delivery-Note-${order.orderNumber}.pdf`,
		});

		res.send(pdf);
	} catch (error) {
		console.error(error);

		res.status(500).json({
			message: 'Failed to generate delivery note',
		});
	}
};

module.exports = {
	generateInvoicePdf,
	generateDeliveryNotePdf,
};
