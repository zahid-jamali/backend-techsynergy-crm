import { Document, Page, Text, View } from '@react-pdf/renderer';
import { h, s, COMPANY, fmtDate, fmtQty, Header, MetaGrid, Party, Table, Footer, Signatures } from './docKit.mjs';

const STATUS = {
	draft: ['DRAFT', '#64748b'],
	in_transit: ['IN TRANSIT', '#b45309'],
	delivered: ['DELIVERED', '#15803d'],
	forwarded_to_finance: ['DELIVERED', '#15803d'],
};

const DeliveryChallanDocument = ({ delivery }) => {
	const order = delivery.order || {};
	const quote = order.finalQuote || {};
	const shipTo = delivery.shipTo || {};
	const items = delivery.items || [];
	const [statusLabel, statusColor] = STATUS[delivery.status] || STATUS.draft;

	const columns = [
		{ label: '#', width: '5%', align: 'center' },
		{ label: 'Item Description', width: '45%' },
		{ label: 'Unit', width: '10%', align: 'center' },
		{ label: 'Ordered', width: '10%', align: 'right' },
		{ label: 'Delivered', width: '10%', align: 'right' },
		{ label: 'Remarks', width: '20%' },
	];
	const rows = items.map((it, i) => [
		String(i + 1),
		[it.productName, it.description],
		it.uoM || 'Units',
		fmtQty(it.orderedQty),
		fmtQty(it.deliveredQty),
		it.remarks || ' ',
	]);
	const footer = [
		'',
		`Total items: ${items.length}`,
		'',
		fmtQty(items.reduce((a, i) => a + (Number(i.orderedQty) || 0), 0)),
		fmtQty(items.reduce((a, i) => a + (Number(i.deliveredQty) || 0), 0)),
		'',
	];

	return h(
		Document,
		{ title: `${delivery.deliveryNumber} — Delivery Challan`, author: COMPANY.name },
		h(
			Page,
			{ size: 'A4', style: s.page },
			delivery.status === 'draft' ? h(Text, { style: s.watermark, fixed: true }, 'DRAFT') : null,
			h(Header, {
				title: 'DELIVERY CHALLAN',
				subtitle: 'Goods dispatch & receipt note',
				status: statusLabel,
				statusColor,
			}),
			h(View, { style: s.rule }),
			h(MetaGrid, {
				items: [
					['Challan No.', delivery.deliveryNumber],
					['Dispatch Date', fmtDate(delivery.dispatchDate || delivery.createdAt)],
					['Sell Order No.', order.orderNumber],
					['Order Date', fmtDate(order.confirmedDate || order.createdAt)],
					['Carrier', delivery.carrier],
					['Tracking / Bilty No.', delivery.trackingNumber],
					['Vehicle No.', delivery.vehicleNumber],
					['Packages', delivery.packages != null ? String(delivery.packages) : ''],
				],
			}),
			h(
				View,
				{ style: s.parties },
				h(Party, {
					heading: 'DISPATCHED FROM',
					name: COMPANY.name,
					rows: [
						['Address', COMPANY.address.slice(0, 2).join(', ')],
						['NTN', 'G141420'],
						['Prepared by', delivery.createdBy?.name],
						['Driver', [delivery.driverName, delivery.driverPhone].filter(Boolean).join(' · ')],
					],
				}),
				h(Party, {
					heading: 'DELIVER TO',
					name: shipTo.name,
					rows: [
						['Address', shipTo.address],
						['Attention', shipTo.contactName],
						['Phone', shipTo.phone],
						['Reference', quote.subject],
					],
				})
			),
			h(Table, { columns, rows, footer }),
			delivery.remarks
				? h(
						View,
						{ style: { marginTop: 10 } },
						h(Text, { style: s.sectionTitle }, 'REMARKS'),
						h(Text, { style: s.small }, delivery.remarks)
				  )
				: null,
			h(
				View,
				{ style: [s.wordsBox, { marginTop: 12 }], wrap: false },
				h(Text, { style: s.sectionTitle }, 'RECEIVER ACKNOWLEDGEMENT'),
				h(
					Text,
					{ style: s.small },
					'Received the above goods in good order and condition. Any shortage, damage or discrepancy must be recorded on this challan at the time of delivery and countersigned by our representative; claims raised afterwards will not be entertained.'
				),
				h(
					View,
					{ style: { flexDirection: 'row', marginTop: 10 } },
					h(View, { style: { width: '50%' } }, h(Text, { style: s.small }, `Received by: ${delivery.receivedBy || '______________________'}`)),
					h(View, { style: { width: '50%' } }, h(Text, { style: s.small }, `Contact: ${delivery.receiverPhone || '______________________'}`))
				),
				h(
					View,
					{ style: { flexDirection: 'row', marginTop: 8 } },
					h(View, { style: { width: '50%' } }, h(Text, { style: s.small }, `Date & time: ${delivery.deliveredAt ? fmtDate(delivery.deliveredAt) : '______________________'}`)),
					h(View, { style: { width: '50%' } }, h(Text, { style: s.small }, 'CNIC: ______________________'))
				)
			),
			h(Signatures, { labels: ['Dispatched by (TechSynergy)', 'Driver / Carrier', 'Receiver signature & stamp'] }),
			h(Footer, { left: `${COMPANY.name}  ·  This challan is not a tax invoice.` })
		)
	);
};

export default DeliveryChallanDocument;
