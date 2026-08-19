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
	TermList,
} from './shared.mjs';

const QuoteDocument = ({ quote }) => {
	const currency = quote.currency || 'PKR';
	const money = (amount) => formatMoney(amount, currency);
	const products = quote.products || [];
	const otherTax = quote.otherTax || [];
	const terms = [...(quote.validUntil
		? [`This quotation is valid until ${formatDate(quote.validUntil)}`]
		: []), ...(quote.termsAndConditions || [])];

	const taxLines = otherTax.map((t) => [
		`${String(t.tax || '').toUpperCase()} (${t.percent}%)`,
		money((Number(quote.subTotal || 0) * Number(t.percent || 0)) / 100),
	]);

	return h(
		Document,
		null,
		h(
			Page,
			{ size: 'A4', style: styles.page },
			h(Text, { style: styles.watermark, fixed: true }, 'QUOTATION'),
			h(DocHeader, {
				title: 'QUOTATION',
				rows: [
					['Quote No:', quote.quoteNumber],
					['Date:', formatDate(new Date())],
					['Valid Until:', formatDate(quote.validUntil)],
				],
			}),
			h(InfoBoxes, {
				leftTitle: 'COMPANY',
				leftLines: COMPANY.address,
				rightTitle: 'CUSTOMER',
				rightHeading: quote.account?.accountName || '',
				rightLines: [capitalize(quote.contact?.email || '')],
			}),
			h(
				Text,
				{ style: styles.paragraph },
				`Dear ${capitalize(quote.contact?.firstName || 'Sir/Madam')},`
			),
			h(
				Text,
				{ style: styles.paragraph },
				'We are pleased to submit our formal quotation as per your requirement. Please find the commercial details below:'
			),
			h(DataTable, {
				columns: [
					{ label: 'S.No', width: '7%' },
					{ label: 'Product', width: '18%' },
					{ label: 'Description', width: '22%' },
					{ label: 'Unit Price', width: '15%', align: 'right' },
					{ label: 'Qty', width: '8%', align: 'right' },
					{ label: 'Tax', width: '12%', align: 'right' },
					{ label: 'Line Total', width: '18%', align: 'right' },
				],
				rows: products.map((p, i) => [
					i + 1,
					p.productName,
					p.description || '-',
					money(p.listPrice),
					p.quantity,
					p.Tax?.length
						? p.Tax.map((t) => `${t.tax} (${t.percent}%)`).join(', ')
						: '-',
					money(p.total),
				]),
			}),
			h(Totals, {
				lines: [['Subtotal', money(quote.subTotal)], ...taxLines],
				grandLabel: 'Total',
				grandValue: money(quote.grandTotal),
			}),
			h(TermList, { title: 'Terms & Conditions:', items: terms, transform: false }),
			h(
				View,
				{ style: { marginTop: 16 }, wrap: false },
				h(Text, { style: styles.bold }, 'Best Regards,'),
				h(Text, { style: styles.light }, capitalize(quote.quoteOwner?.name || '')),
				h(Text, { style: styles.light }, quote.quoteOwner?.email || ''),
				h(Text, { style: styles.light }, 'TechSynergy Innovations Pvt. Ltd.')
			),
			h(Footer, null)
		)
	);
};

export default QuoteDocument;
