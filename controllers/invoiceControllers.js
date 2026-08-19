const Order = require('../models/Order');
const { sendPdf } = require('../lib/pdf/renderPdf');

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

		return sendPdf(
			res,
			'InvoiceDocument',
			{ order },
			`Invoice-${order.orderNumber || order._id}.pdf`
		);
	} catch (error) {
		console.error('Invoice PDF Error:', error);

		return res.status(500).json({
			success: false,
			message: 'Failed to generate invoice PDF',
		});
	}
};


const addInvoiceTermsAndConditions=async (req, res )=>{
	try{
		if(!req.query?.orderId || !req.body?.termsAndConditions ){
			res.status(400).json({message:"order id or conditions are not provided"});
		}
		const order=await Order.findById(req.query.orderId);
		order.invoiceTermsAndConditions=req.body.termsAndConditions;
		await order.save();
		res.status(200).json({message:"Invoice terms and conditions are added!"});
	}catch(error){
		console.error(error);
		res.status(500).json({message:"Internal server error"})
	}
}



const generateDeliveryNotePdf = async (req, res) => {
	try {
		const order = await Order.findById(req.params.id).populate({
			path: 'finalQuote',
			populate: [{ path: 'account' }, { path: 'contact' }],
		});

		if (!order) {
			return res.status(404).json({ message: 'Order not found' });
		}

		return sendPdf(
			res,
			'DeliveryNoteDocument',
			{ order },
			`Delivery-Note-${order.orderNumber}.pdf`
		);
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
	addInvoiceTermsAndConditions
};
