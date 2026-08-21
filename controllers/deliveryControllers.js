const Delivery = require('../models/Delivery');
const Order = require('../models/Order');
const getNextSequence = require('../lib/getNextSequence');
const fileFromMulter = require('../lib/uploadedFile');
const { notifyDeliveryCompleted } = require('../lib/notifications');

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
		const { orderId, carrier, trackingNumber, remarks, status } = req.body;

		if (!orderId) {
			return res.status(400).json({ msg: 'Sell order is required' });
		}

		const order = await Order.findById(orderId);
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

		const delivery = await Delivery.create({
			deliveryNumber,
			order: orderId,
			carrier,
			trackingNumber,
			remarks,
			status: status || 'draft',
			deliveryNote: fileFromMulter(files.deliveryNote?.[0]),
			supportingDocuments: supporting,
			createdBy: req.user.id,
			deliveredAt: status === 'delivered' ? new Date() : undefined,
		});

		if (
			['ready_for_operations', 'po_created'].includes(order.fulfillmentStatus)
		) {
			order.fulfillmentStatus =
				status === 'delivered' ? 'delivered' : 'in_delivery';
			await order.save();
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

		const { carrier, trackingNumber, remarks, status } = req.body;
		if (carrier !== undefined) delivery.carrier = carrier;
		if (trackingNumber !== undefined) delivery.trackingNumber = trackingNumber;
		if (remarks !== undefined) delivery.remarks = remarks;

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

		if (status && ['draft', 'in_transit', 'delivered'].includes(status)) {
			delivery.status = status;
			if (status === 'delivered' && !delivery.deliveredAt) {
				delivery.deliveredAt = new Date();
			}
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

		if (!delivery.deliveryNote?.url) {
			return res.status(400).json({
				msg: 'Upload a delivery note copy before marking as delivered',
			});
		}

		delivery.status = 'delivered';
		delivery.deliveredAt = new Date();
		if (req.body.remarks !== undefined) delivery.remarks = req.body.remarks;
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

module.exports = {
	createDelivery,
	getDeliveries,
	getDeliveryById,
	updateDelivery,
	markDelivered,
	forwardToFinance,
	getOperationsDashboard,
};
