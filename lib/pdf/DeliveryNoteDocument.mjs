import { Document, Page, Text, View } from '@react-pdf/renderer';
import {
	h,
	styles,
	COMPANY,
	capitalize,
	formatDate,
	DocHeader,
	InfoBoxes,
	DataTable,
	Footer,
	Signatures,
} from './shared.mjs';

const DeliveryNoteDocument = ({ order }) => {
	const quote = order.finalQuote || {};
	const account = quote.account || {};
	const contact = quote.contact || {};
	const billing = account.billingAddress || {};
	const products = order.products || [];

	const billingAddress = account.billingAddress
		? [
				`${billing.street || ''}, ${billing.city || ''}, ${billing.state || ''}, ${
					billing.country || ''
				}`.replace(/,\s+,/g, ','),
				`Phone: ${contact.phone || '-'}`,
				`Email: ${contact.email || '-'}`,
		  ]
		: [`Phone: ${contact.phone || '-'}`, `Email: ${contact.email || '-'}`];

	return h(
		Document,
		null,
		h(
			Page,
			{ size: 'A4', style: styles.page },
			h(DocHeader, {
				title: 'DELIVERY NOTE',
				rows: [
					['Delivery No:', order.orderNumber || order._id],
					['Date:', formatDate(order.confirmedDate || order.createdAt)],
					['Status:', order.status],
				],
			}),
			h(InfoBoxes, {
				leftTitle: 'COMPANY',
				leftLines: COMPANY.address,
				rightTitle: 'CUSTOMER',
				rightHeading: capitalize(account.accountName || ''),
				rightLines: billingAddress,
			}),
			h(DataTable, {
				columns: [
					{ label: 'S.No', width: '8%' },
					{ label: 'Description', width: '52%' },
					{ label: 'Quantity', width: '15%', align: 'right' },
					{ label: 'Remarks', width: '25%' },
				],
				rows: products.map((p, i) => [
					i + 1,
					capitalize(p.productName),
					p.quantity,
					'Received in good condition',
				]),
			}),
			h(
				View,
				{ style: { marginTop: 16 } },
				h(Text, { style: styles.bold }, 'Note:'),
				h(
					Text,
					{ style: styles.light },
					'This Delivery Note serves as proof of receipt. The recipient must thoroughly inspect all delivered items at the time of delivery. Any discrepancies, damages, or shortages must be clearly stated on the Delivery Note and acknowledged by the delivery representative. The company shall not be liable for any claims submitted after delivery completion.'
				)
			),
			h(Signatures, null),
			h(Footer, null)
		)
	);
};

export default DeliveryNoteDocument;
