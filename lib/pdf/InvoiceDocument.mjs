import { Document, Page, Text, View } from '@react-pdf/renderer';
import {
	h,
	styles,
	COMPANY,
	capitalize,
	formatDate,
	formatMoney,
	DocHeader,
	InfoBoxes,
	DataTable,
	Totals,
	Footer,
	Signatures,
	TermList,
} from './shared.mjs';

const InvoiceDocument = ({ order }) => {
	const quote = order.finalQuote || {};
	const account = quote.account || {};
	const contact = quote.contact || {};
	const billing = account.billingAddress || {};
	const taxes = order.Tax?.length ? order.Tax : order.otherTax || [];

	let totalTax = 0;
	const taxLines = taxes.map((t) => {
		const taxAmount =
			t.amount != null
				? Number(t.amount)
				: (Number(order.subtotal || 0) * Number(t.percent || 0)) / 100;
		totalTax += taxAmount;
		return [`${t.tax} (${t.percent}%)`, formatMoney(taxAmount)];
	});

	const billingAddress = account.billingAddress
		? [
				`${billing.street || ''}, ${billing.city || ''}, ${billing.state || ''}, ${
					billing.country || ''
				}`.replace(/,\s+,/g, ','),
				`Phone: ${contact.phone || '-'}`,
				`Email: ${contact.email || '-'}`,
		  ]
		: [`Phone: ${contact.phone || '-'}`, `Email: ${contact.email || '-'}`];

	const products = order.products || [];
	const terms = order.invoiceTermsAndConditions || [];

	return h(
		Document,
		null,
		h(
			Page,
			{ size: 'A4', style: styles.page },
			h(DocHeader, {
				title: 'SALES INVOICE',
				rows: [
					['Invoice No:', order.orderNumber || order._id],
					['Date:', formatDate(order.confirmedDate || order.createdAt)],
					['Status:', order.status],
				],
			}),
			h(InfoBoxes, {
				leftTitle: 'COMPANY',
				leftLines: COMPANY.address,
				rightTitle: 'BILL TO',
				rightHeading: capitalize(account.accountName || ''),
				rightLines: billingAddress,
			}),
			h(DataTable, {
				columns: [
					{ label: 'S.No', width: '8%' },
					{ label: 'Description', width: '42%' },
					{ label: 'Qty', width: '12%', align: 'right' },
					{ label: 'Unit Price', width: '19%', align: 'right' },
					{ label: 'Amount', width: '19%', align: 'right' },
				],
				rows: products.map((p, i) => [
					i + 1,
					capitalize(p.productName),
					p.quantity,
					formatMoney(p.listPrice),
					formatMoney(p.total),
				]),
			}),
			h(Totals, {
				lines: [
					['Subtotal', formatMoney(order.subtotal)],
					...taxLines,
					...(taxes.length ? [['Total Tax', formatMoney(totalTax)]] : []),
				],
				grandLabel: 'Total',
				grandValue: formatMoney(order.grandTotal),
			}),
			h(TermList, {
				title: 'Commercial terms & Conditions',
				items: terms,
				transform: false,
			}),
			h(
				View,
				{ style: styles.bank, wrap: false },
				h(Text, { style: styles.bold }, 'Bank Details:'),
				COMPANY.bank.map((line, index) =>
					h(Text, { key: `b-${index}`, style: styles.light }, line)
				)
			),
			h(Signatures, null),
			h(Footer, null)
		)
	);
};

export default InvoiceDocument;
