import { Document, Page, Text } from '@react-pdf/renderer';
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

const POToVendorDocument = ({ po }) => {
	const money = (amount) => formatMoney(amount, 'PKR');
	const products = po.products || [];
	const taxes = po.Tax || [];
	const taxLines = taxes.map((t) => [
		`${String(t.tax || '').toUpperCase()} (${t.percent}%)`,
		money(t.amount),
	]);

	return h(
		Document,
		null,
		h(
			Page,
			{ size: 'A4', style: styles.page },
			h(DocHeader, {
				title: 'PURCHASE ORDER TO VENDOR',
				rows: [
					['PO No:', po.poToNumber],
					['Date:', formatDate(po.createdAt)],
					['Reference Quote:', po.refQuote?.quoteNumber || '-'],
				],
			}),
			h(InfoBoxes, {
				leftTitle: 'COMPANY',
				leftLines: COMPANY.shortAddress,
				rightTitle: 'VENDOR',
				rightHeading: capitalize(po.vendor?.name || ''),
				rightLines: [`Status: ${po.vendor?.status || '-'}`],
			}),
			h(Text, { style: styles.paragraph }, `Subject: ${po.subject || ''}`),
			h(DataTable, {
				columns: [
					{ label: 'S.No', width: '8%' },
					{ label: 'Product Description', width: '44%' },
					{ label: 'Qty', width: '12%', align: 'right' },
					{ label: 'Unit Price', width: '18%', align: 'right' },
					{ label: 'Line Total', width: '18%', align: 'right' },
				],
				rows:
					products.length > 0
						? products.map((p, i) => [
								i + 1,
								capitalize(p.productName),
								p.quantity,
								money(p.listPrice),
								money(p.amount),
						  ])
						: [['', 'No products available', '', '', '']],
			}),
			h(Totals, {
				lines: [['Subtotal', money(po.subTotal)], ...taxLines],
				grandLabel: 'Total',
				grandValue: money(po.grandTotal),
			}),
			h(TermList, {
				title: 'Terms & Conditions:',
				items: po.termsAndConditions || [],
			}),
			h(Footer, null)
		)
	);
};

export default POToVendorDocument;
