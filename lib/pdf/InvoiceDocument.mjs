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
					{ label: '#', width: '6%' },
					{ label: 'Description', width: '34%' },
					{ label: 'Unit Price', width: '16%', align: 'right' },
					{ label: 'Qty', width: '10%', align: 'right' },
					{ label: 'Amount', width: '16%', align: 'right', strong: true },
					{ label: 'Line Total', width: '18%', align: 'right', strong: true },
				],
				rows: products.map((p, i) => {
					const unit = Number(p.listPrice) || 0;
					const qty = Number(p.quantity) || 0;
					const amount =
						Number(p.amount) > 0
							? Number(p.amount)
							: Math.round(unit * qty * 100) / 100;
					const total =
						Number(p.total) > 0 ? Number(p.total) : amount;
					return [
						i + 1,
						capitalize(p.productName),
						formatMoney(unit),
						qty,
						formatMoney(amount),
						formatMoney(total),
					];
				}),
				footer: (() => {
					const qtySum = products.reduce(
						(sum, p) => sum + (Number(p.quantity) || 0),
						0
					);
					const amountSum = products.reduce((sum, p) => {
						const unit = Number(p.listPrice) || 0;
						const qty = Number(p.quantity) || 0;
						const amount =
							Number(p.amount) > 0
								? Number(p.amount)
								: Math.round(unit * qty * 100) / 100;
						return sum + amount;
					}, 0);
					const totalSum = products.reduce((sum, p) => {
						const unit = Number(p.listPrice) || 0;
						const qty = Number(p.quantity) || 0;
						const amount =
							Number(p.amount) > 0
								? Number(p.amount)
								: Math.round(unit * qty * 100) / 100;
						const total =
							Number(p.total) > 0 ? Number(p.total) : amount;
						return sum + total;
					}, 0);
					return [
						'',
						'Totals',
						'',
						qtySum,
						formatMoney(amountSum),
						formatMoney(totalSum),
					];
				})(),
				note: 'Amount = Unit Price × Qty',
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
