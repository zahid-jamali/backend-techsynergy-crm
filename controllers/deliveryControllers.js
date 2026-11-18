const Delivery = require('../models/Delivery');
const Order = require('../models/Order');
const getNextSequence = require('../lib/getNextSequence');
const fileFromMulter = require('../lib/uploadedFile');
const { notifyDeliveryCompleted } = require('../lib/notifications');
const { sendPdf } = require('../lib/pdf/renderPdf');

const TEXT_FIELDS = [
	'carrier',
	'trackingNumber',
	'remarks',
	'vehicleNumber',
	'driverName',
	'driverPhone',
	'receivedBy',
	'receiverPhone',
];

const parseJson = (value, fallback) => {
	if (value === undefined || value === null || value === '') return fallback;
	if (typeof value === 'object') return value;
	try {
		return JSON.parse(value);
	} catch {
		return fallback;
	}
};

/** Apply the editable challan fields from a (multipart) request body. */
const applyDetails = (delivery, body = {}) => {
	TEXT_FIELDS.forEach((k) => {
		if (body[k] !== undefined) delivery[k] = String(body[k]).trim();
	});
	if (body.packages !== undefined && body.packages !== '') {
		delivery.packages = Math.max(0, Number(body.packages) || 0);
	}
	if (body.dispatchDate) {
		const d = new Date(body.dispatchDate);
		if (!Number.isNaN(d.getTime())) delivery.dispatchDate = d;
	}
	const shipTo = parseJson(body.shipTo, null);
	if (shipTo && typeof shipTo === 'object') {
		delivery.shipTo = {
			name: String(shipTo.name || '').trim(),
			address: String(shipTo.address || '').trim(),
			contactName: String(shipTo.contactName || '').trim(),
			phone: String(shipTo.phone || '').trim(),
		};
	}
	const items = parseJson(body.items, null);
	if (Array.isArray(items)) {
		delivery.items = items
			.filter((i) => i && String(i.productName || '').trim())
			.map((i) => ({
				productName: String(i.productName).trim(),
				description: String(i.description || '').trim(),
				uoM: String(i.uoM || 'Units').trim(),
				orderedQty: Math.max(0, Number(i.orderedQty) || 0),
				deliveredQty: Math.max(0, Number(i.deliveredQty) || 0),
				remarks: String(i.remarks || '').trim(),
			}));
	}
};

const addressText = (a = {}) =>
	[a.street, a.city, a.state, a.postalCode, a.country].filter(Boolean).join(', ');

/** Default ship-to and item list taken from the sell order. */
const defaultsFromOrder = (order) => {
	const quote = order.finalQuote || {};
	const account = quote.account || {};
	const contact = quote.contact || {};
	const ship = account.shippingAddress || {};
	const addr = ship.street || ship.city ? ship : account.billingAddress;
	return {
		shipTo: {
			name: account.accountName || '',
			address: addressText(addr || {}),
			contactName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
			phone: contact.phone || account.phone || '',
		},
		items: (order.products || []).map((p) => ({
			productName: p.productName,
			description: p.description || '',
			uoM: 'Units',
			orderedQty: Number(p.quantity) || 0,
			deliveredQty: Number(p.quantity) || 0,
		})),
	};
};

const populateDelivery = (query) =>
	query
		.populate({
			path: 'order',
			populate: [
				{
					path: 'finalQuote',
					select: 'subject quoteStage currency finalTotal',
					populate: [
						{ path: 'deal', select: 'dealName stage' },
						{ path: 'account', select: 'accountName' },
						{ path: 'contact', select: 'firstName lastName' },
					],
				},
				{ path: 'createdBy', select: 'name email' },
			],
		})
		.populate('createdBy', 'name email role')
		.populate('forwardedBy', 'name email role');

let synced = false;
const syncApprovedOrders = async () => {
	if (synced) return;
	await Order.updateMany(
		{
			isSOApproved: true,
			status: 'Accepted',
			$or: [
				{ fulfillmentStatus: { $exists: false } },
				{ fulfillmentStatus: 'awaiting_approval' },
			],
		},
		{ $set: { fulfillmentStatus: 'ready_for_operations' } }
	);
	synced = true;
};

const createDelivery = async (req, res) => {
	try {
		const { orderId, status } = req.body;

		if (!orderId) {
			return res.status(400).json({ msg: 'Sell order is required' });
		}

		const order = await Order.findById(orderId).populate({
			path: 'finalQuote',
			populate: [{ path: 'account' }, { path: 'contact' }],
		});
		if (!order || !order.isActive) {
			return res.status(404).json({ msg: 'Sell order not found' });
		}
		if (!order.isSOApproved || order.status !== 'Accepted') {
			return res.status(400).json({
				msg: 'Deliveries can only be created for approved sell orders',
			});
		}

		const existing = await Delivery.findOne({
			order: orderId,
			isActive: true,
		});
		if (existing) {
			return res.status(409).json({
				msg: 'A delivery already exists for this sell order',
				data: existing,
			});
		}

		const seq = await getNextSequence('delivery');
		const deliveryNumber = `DN-${String(seq).padStart(5, '0')}`;

		const files = req.files || {};
		const supporting = (files.supportingDocuments || []).map(fileFromMulter);

		const safeStatus = ['draft', 'in_transit'].includes(status) ? status : 'draft';
		const delivery = new Delivery({
			deliveryNumber,
			order: orderId,
			status: safeStatus,
			dispatchDate: new Date(),
			...defaultsFromOrder(order),
			deliveryNote: fileFromMulter(files.deliveryNote?.[0]),
			supportingDocuments: supporting,
			createdBy: req.user.id,
		});
		applyDetails(delivery, req.body);
		await delivery.save();

		if (
			['ready_for_operations', 'po_created'].includes(order.fulfillmentStatus)
		) {
			await Order.updateOne({ _id: order._id }, { fulfillmentStatus: 'in_delivery' });
		}

		const populated = await populateDelivery(Delivery.findById(delivery._id));

		return res.status(201).json({
			success: true,
			msg: 'Delivery created',
			data: populated,
		});
	} catch (error) {
		console.error('Create Delivery Error:', error);
		return res.status(500).json({ msg: 'Failed to create delivery' });
	}
};

const getDeliveries = async (req, res) => {
	try {
		await syncApprovedOrders();

		const { status, orderId } = req.query;
		const filter = { isActive: true };
		if (status) {
			const statuses = String(status)
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean);
			filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
		}
		if (orderId) filter.order = orderId;

		const deliveries = await populateDelivery(
			Delivery.find(filter).sort({ createdAt: -1 })
		);

		return res.json({ success: true, data: deliveries });
	} catch (error) {
		console.error('Get Deliveries Error:', error);
		return res.status(500).json({ msg: 'Failed to fetch deliveries' });
	}
};

const getDeliveryById = async (req, res) => {
	try {
		const delivery = await populateDelivery(
			Delivery.findById(req.params.id)
		);
		if (!delivery || !delivery.isActive) {
			return res.status(404).json({ msg: 'Delivery not found' });
		}
		return res.json({ success: true, data: delivery });
	} catch (error) {
		return res.status(500).json({ msg: 'Failed to fetch delivery' });
	}
};

const updateDelivery = async (req, res) => {
	try {
		const delivery = await Delivery.findById(req.params.id);
		if (!delivery || !delivery.isActive) {
			return res.status(404).json({ msg: 'Delivery not found' });
		}
		if (delivery.status === 'forwarded_to_finance') {
			return res.status(400).json({
				msg: 'This delivery has already been forwarded to finance',
			});
		}

		const { status } = req.body;
		applyDetails(delivery, req.body);

		const files = req.files || {};
		if (files.deliveryNote?.[0]) {
			delivery.deliveryNote = fileFromMulter(files.deliveryNote[0]);
		}
		if (files.supportingDocuments?.length) {
			delivery.supportingDocuments = [
				...(delivery.supportingDocuments || []),
				...files.supportingDocuments.map(fileFromMulter),
			];
		}

		// "delivered" requires the signed copy, so it goes through markDelivered.
		if (status && ['draft', 'in_transit'].includes(status) && delivery.status !== 'delivered') {
			delivery.status = status;
		}

		await delivery.save();

		const order = await Order.findById(delivery.order);
		if (order && order.fulfillmentStatus !== 'forwarded_to_finance' && order.fulfillmentStatus !== 'invoiced') {
			order.fulfillmentStatus =
				delivery.status === 'delivered' ? 'delivered' : 'in_delivery';
			await order.save();
		}

		const populated = await populateDelivery(Delivery.findById(delivery._id));
		return res.json({ success: true, msg: 'Delivery updated', data: populated });
	} catch (error) {
		console.error('Update Delivery Error:', error);
		return res.status(500).json({ msg: 'Failed to update delivery' });
	}
};

const markDelivered = async (req, res) => {
	try {
		const delivery = await Delivery.findById(req.params.id);
		if (!delivery || !delivery.isActive) {
			return res.status(404).json({ msg: 'Delivery not found' });
		}

		const files = req.files || {};
		if (files.deliveryNote?.[0]) {
			delivery.deliveryNote = fileFromMulter(files.deliveryNote[0]);
		}
		if (files.supportingDocuments?.length) {
			delivery.supportingDocuments = [
				...(delivery.supportingDocuments || []),
				...files.supportingDocuments.map(fileFromMulter),
			];
		}

		if (delivery.status === 'forwarded_to_finance') {
			return res.status(400).json({ msg: 'This delivery has already been forwarded to finance' });
		}
		applyDetails(delivery, req.body);
		if (!delivery.deliveryNote?.url) {
			return res.status(400).json({
				msg: 'Upload the signed delivery challan copy before marking as delivered',
			});
		}
		if (!delivery.receivedBy) {
			return res.status(400).json({ msg: 'Enter who received the goods before marking as delivered' });
		}

		delivery.status = 'delivered';
		delivery.deliveredAt = new Date();
		await delivery.save();

		await Order.findByIdAndUpdate(delivery.order, {
			fulfillmentStatus: 'delivered',
		});

		const populated = await populateDelivery(Delivery.findById(delivery._id));
		await notifyDeliveryCompleted(populated, req.user);
		return res.json({
			success: true,
			msg: 'Marked as delivered',
			data: populated,
		});
	} catch (error) {
		console.error('Mark Delivered Error:', error);
		return res.status(500).json({ msg: 'Failed to mark delivered' });
	}
};

const forwardToFinance = async (req, res) => {
	try {
		const delivery = await Delivery.findById(req.params.id);
		if (!delivery || !delivery.isActive) {
			return res.status(404).json({ msg: 'Delivery not found' });
		}
		if (delivery.status === 'forwarded_to_finance') {
			return res.status(400).json({ msg: 'Already forwarded to finance' });
		}
		if (delivery.status !== 'delivered') {
			return res.status(400).json({
				msg: 'Mark the order as delivered before forwarding to finance',
			});
		}
		if (!delivery.deliveryNote?.url) {
			return res.status(400).json({
				msg: 'Attach a delivery note copy before forwarding',
			});
		}

		delivery.status = 'forwarded_to_finance';
		delivery.forwardedAt = new Date();
		delivery.forwardedBy = req.user.id;
		await delivery.save();

		await Order.findByIdAndUpdate(delivery.order, {
			fulfillmentStatus: 'forwarded_to_finance',
		});

		const populated = await populateDelivery(Delivery.findById(delivery._id));
		return res.json({
			success: true,
			msg: 'Forwarded to finance',
			data: populated,
		});
	} catch (error) {
		console.error('Forward Delivery Error:', error);
		return res.status(500).json({ msg: 'Failed to forward delivery' });
	}
};

const getOperationsDashboard = async (req, res) => {
	try {
		await syncApprovedOrders();

		const [
			readyForOps,
			poCreated,
			inDelivery,
			delivered,
			forwarded,
			recentDeliveries,
		] = await Promise.all([
			Order.countDocuments({
				isActive: true,
				isSOApproved: true,
				status: 'Accepted',
				fulfillmentStatus: 'ready_for_operations',
			}),
			Order.countDocuments({
				isActive: true,
				fulfillmentStatus: 'po_created',
			}),
			Order.countDocuments({
				isActive: true,
				fulfillmentStatus: 'in_delivery',
			}),
			Order.countDocuments({
				isActive: true,
				fulfillmentStatus: 'delivered',
			}),
			Order.countDocuments({
				isActive: true,
				fulfillmentStatus: 'forwarded_to_finance',
			}),
			populateDelivery(
				Delivery.find({ isActive: true }).sort({ updatedAt: -1 }).limit(6)
			),
		]);

		return res.json({
			success: true,
			data: {
				kpis: {
					readyForOps,
					poCreated,
					inDelivery,
					delivered,
					forwarded,
				},
				recentDeliveries,
			},
		});
	} catch (error) {
		console.error('Ops Dashboard Error:', error);
		return res.status(500).json({ msg: 'Failed to load operations dashboard' });
	}
};

const downloadDeliveryChallan = async (req, res) => {
	try {
		const delivery = await Delivery.findById(req.params.id)
			.populate({
				path: 'order',
				populate: {
					path: 'finalQuote',
					select: 'subject account contact',
					populate: [
						{ path: 'account', select: 'accountName billingAddress shippingAddress phone' },
						{ path: 'contact', select: 'firstName lastName phone email' },
					],
				},
			})
			.populate('createdBy', 'name')
			.lean();
		if (!delivery || !delivery.isActive) {
			return res.status(404).json({ msg: 'Delivery not found' });
		}
		const d = defaultsFromOrder(delivery.order || {});
		if (!delivery.items?.length) delivery.items = d.items;
		if (!delivery.shipTo?.name) delivery.shipTo = d.shipTo;
		return sendPdf(
			res,
			'DeliveryChallanDocument',
			{ delivery },
			`${delivery.deliveryNumber || 'Delivery-Challan'}.pdf`
		);
	} catch (error) {
		console.error('Delivery Challan PDF Error:', error);
		if (!res.headersSent) return res.status(500).json({ msg: 'Failed to generate delivery challan' });
	}
};

module.exports = {
	downloadDeliveryChallan,
	createDelivery,
	getDeliveries,
	getDeliveryById,
	updateDelivery,
	markDelivered,
	forwardToFinance,
	getOperationsDashboard,
};
